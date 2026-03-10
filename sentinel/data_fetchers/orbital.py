import asyncio
import logging
import math
from datetime import datetime
from typing import List

import httpx
from pydantic import BaseModel
from sgp4.api import Satrec, jday

from config import CELESTRAK_BASE

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0
ORBIT_WINDOW_KM = 50


class OrbitalData(BaseModel):
    object_count_near_orbit: int
    collision_probability: float
    debris_collision_probability: float
    conjunction_objects: list[dict]  # {name: str, distance_km: float}
    timestamp: str


async def _fetch_tles() -> List[str]:
    """Fetch raw TLE text from Celestrak with retry."""
    url = f"{CELESTRAK_BASE}/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(url)
                r.raise_for_status()
                return r.text.splitlines()
        except Exception as e:
            logger.warning(f"TLE fetch attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2 ** attempt)

    raise RuntimeError("Failed to fetch TLE data")


def _parse_tles(lines: List[str]):
    """Convert TLE lines into satellite tuples."""
    sats = []

    for i in range(0, len(lines) - 2, 3):
        name = lines[i].strip()
        l1 = lines[i + 1].strip()
        l2 = lines[i + 2].strip()

        if l1.startswith("1 ") and l2.startswith("2 "):
            sats.append((name, l1, l2))

    return sats


def _propagate_altitude(sat: Satrec, jd: float, fr: float) -> float | None:
    """Propagate satellite and compute altitude."""
    err, r, _ = sat.sgp4(jd, fr)

    if err != 0:
        return None

    r_km = math.sqrt(r[0] ** 2 + r[1] ** 2 + r[2] ** 2)
    return r_km - EARTH_RADIUS_KM


async def fetch_orbital(orbit_alt_km: float, launch_time: str) -> OrbitalData:
    """
    Estimate orbital congestion near a given orbital shell.
    """

    try:
        # Parse launch time
        launch_dt = datetime.fromisoformat(launch_time)

        jd, fr = jday(
            launch_dt.year,
            launch_dt.month,
            launch_dt.day,
            launch_dt.hour,
            launch_dt.minute,
            launch_dt.second + launch_dt.microsecond / 1e6,
        )

        # Fetch TLEs
        lines = await _fetch_tles()
        satellites = _parse_tles(lines)

        object_count = 0
        conjunction_objects = []

        for name, l1, l2 in satellites:
            try:
                sat = Satrec.twoline2rv(l1, l2)

                alt = _propagate_altitude(sat, jd, fr)

                if alt is None:
                    continue

                distance = abs(alt - orbit_alt_km)

                if distance <= ORBIT_WINDOW_KM:
                    object_count += 1

                    # keep a small sample list
                    if len(conjunction_objects) < 20:
                        conjunction_objects.append(
                            {
                                "name": name,
                                "distance_km": round(distance, 3),
                            }
                        )

            except Exception:
                continue
        SIGMA_KM2 = 3.14e-4        # collision cross-section (km²)
        REL_VELOCITY_KMS = 7.5     # relative velocity (km/s)
        SHELL_VOLUME_KM3 = 4 * 3.14159 * (EARTH_RADIUS_KM + orbit_alt_km)**2 * ORBIT_WINDOW_KM

        pc_per_object = (SIGMA_KM2 * REL_VELOCITY_KMS * 90) / SHELL_VOLUME_KM3
        collision_probability = min(object_count * pc_per_object, 1.0)
        debris_collision_probability = collision_probability * 1.5  # debris harder to avoid
        

        return OrbitalData(
            object_count_near_orbit=object_count,
            collision_probability=collision_probability,
            debris_collision_probability=debris_collision_probability,
            conjunction_objects=conjunction_objects,
            timestamp=launch_dt.isoformat(),
        )

    except Exception as e:
        logger.error(f"Orbital fetch failed: {e}")

        return OrbitalData(
            object_count_near_orbit=0,
            collision_probability=0.0,
            debris_collision_probability=0.0,
            conjunction_objects=[],
            timestamp=launch_time,
        )