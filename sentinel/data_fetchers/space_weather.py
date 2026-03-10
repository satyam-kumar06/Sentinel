import asyncio
import httpx
import logging
from datetime import datetime, timedelta
from pydantic import BaseModel
from config import SWPC_BASE, DONKI_BASE

logger = logging.getLogger(__name__)


class SpaceWeatherData(BaseModel):
    kp_index: float
    g_scale: int
    s_scale: int
    r_scale: int
    cme_arrivals: list[dict]
    m_class_probability: float
    x_class_probability: float
    timestamp: str


async def fetch_swpc() -> dict:
    """Fetch Kp index and storm scales from SWPC"""
    url = f"{SWPC_BASE}/products/noaa-planetary-k-index.json"

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()

                latest = data[-1]
                kp_index = float(latest[1])
                timestamp = latest[0]

                # Convert Kp → G scale
                g_scale = max(0, min(5, int(kp_index) - 4)) if kp_index >= 5 else 0

                return {
                    "kp_index": kp_index,
                    "g_scale": g_scale,
                    "s_scale": 0,
                    "r_scale": 0,
                    "timestamp": timestamp,
                }

        except Exception as e:
            logger.warning(f"SWPC fetch attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2 ** attempt)

    return {
        "kp_index": 0.0,
        "g_scale": 0,
        "s_scale": 0,
        "r_scale": 0,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def fetch_donki(api_key: str) -> dict:
    """Fetch CME arrivals and flare probabilities from NASA DONKI"""

    start_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    end_date = datetime.utcnow().strftime("%Y-%m-%d")

    cme_arrivals = []
    m_class_probability = 0.0
    x_class_probability = 0.0

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10) as client:

                # CME Analysis
                cme_url = (
                    f"{DONKI_BASE}/CMEAnalysis?"
                    f"startDate={start_date}&endDate={end_date}&api_key={api_key}"
                )

                r = await client.get(cme_url)
                r.raise_for_status()
                cmes = r.json()

                for c in cmes:
                    arrival = c.get("arrivalTime")
                    speed = c.get("speed")

                    if arrival and speed:
                        cme_arrivals.append(
                            {
                                "arrival_time": arrival,
                                "speed_kms": float(speed),
                            }
                        )

                # Solar flare data
                flr_url = (
                    f"{DONKI_BASE}/FLR?"
                    f"startDate={start_date}&endDate={end_date}&api_key={api_key}"
                )

                r2 = await client.get(flr_url)
                r2.raise_for_status()
                flares = r2.json()

                total = len(flares)
                if total > 0:
                    m_count = sum(
                        1 for f in flares if f.get("classType", "").startswith("M")
                    )
                    x_count = sum(
                        1 for f in flares if f.get("classType", "").startswith("X")
                    )

                    m_class_probability = m_count / total
                    x_class_probability = x_count / total

                break

        except Exception as e:
            logger.warning(f"DONKI fetch attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2 ** attempt)

    return {
        "cme_arrivals": cme_arrivals,
        "m_class_probability": m_class_probability,
        "x_class_probability": x_class_probability,
    }


async def fetch_space_weather(api_key: str) -> SpaceWeatherData:
    """Fetch and merge SWPC + DONKI space weather data"""

    swpc_data, donki_data = await asyncio.gather(
        fetch_swpc(),
        fetch_donki(api_key),
    )

    merged = {
        **swpc_data,
        **donki_data,
    }

    return SpaceWeatherData(**merged)