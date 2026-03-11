import httpx
import asyncio
import logging
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from config import NWS_BASE

logger = logging.getLogger(__name__)


class WeatherData(BaseModel):
    wind_speed_kts: float
    visibility_mi: float
    ceiling_ft: float
    temp_f: float
    precipitation: bool
    lightning: bool
    thunderstorm_alert: bool
    alerts: list[str]
    timestamp: str


HEADERS = {
    "User-Agent": "SENTINEL",
    "Accept": "application/geo+json"
}


async def fetch_weather(lat: float, lng: float) -> Optional[WeatherData]:
    # Use Open-Meteo for non-US locations, NWS for US
    is_usa = -130 <= lng <= -60 and 20 <= lat <= 55
    
    if is_usa:
        return await _fetch_nws(lat, lng)
    else:
        return await _fetch_openmeteo(lat, lng)


_weather_cache = {}
_cache_time = {}

async def _fetch_openmeteo(lat: float, lng: float) -> Optional[WeatherData]:
    cache_key = f"{lat},{lng}"
    now = datetime.utcnow().timestamp()

    if cache_key in _weather_cache and now - _cache_time.get(cache_key, 0) < 300:
        return _weather_cache[cache_key]

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        f"&current=temperature_2m,wind_speed_10m,visibility,precipitation,weather_code"
        f"&wind_speed_unit=kn&temperature_unit=celsius"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            r.raise_for_status()
            c = r.json()["current"]

            wind_kts = float(c.get("wind_speed_10m") or 0)
            temp_c   = float(c.get("temperature_2m") or 21)
            temp_f   = round(temp_c * 9/5 + 32, 1)
            vis_m    = float(c.get("visibility") or 16000)
            vis_mi   = vis_m / 1609.34
            precip   = float(c.get("precipitation") or 0) > 0
            wcode    = int(c.get("weather_code") or 0)
            thunder  = wcode in [95, 96, 99]
            lightning = thunder

            result = WeatherData(
                wind_speed_kts=round(wind_kts, 1),
                visibility_mi=round(vis_mi, 2),
                ceiling_ft=99999.0,
                temp_f=temp_f,
                precipitation=precip,
                lightning=lightning,
                thunderstorm_alert=thunder,
                alerts=[],
                timestamp=datetime.utcnow().isoformat()
            )

            _weather_cache[cache_key] = result
            _cache_time[cache_key] = now
            return result

    except Exception as e:
        logger.error(f"Open-Meteo fetch failed: {e}")
        return None