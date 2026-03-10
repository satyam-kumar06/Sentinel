from pydantic import BaseModel
from typing import Any
from datetime import datetime, timedelta

from config import (
    WIND_MAX_KTS,
    VISIBILITY_MIN_MI,
    CEILING_MIN_FT,
    CME_MIN_HOURS,
    RADIO_BLACKOUT_MAX,
    GEO_STORM_MAX,
    PC_CREWED_MAX,
    PC_DEBRIS_MAX
)

from data_fetchers.weather import WeatherData
from data_fetchers.space_weather import SpaceWeatherData
from data_fetchers.orbital import OrbitalData


class RuleResult(BaseModel):
    name: str
    passed: bool
    value: Any
    threshold: str
    source: str


class HardRulesResult(BaseModel):
    passed: bool
    results: list[RuleResult]
    failures: list[RuleResult]


def rule_lightning(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = not weather.lightning
    return RuleResult(
        name="Lightning",
        passed=passed,
        value=weather.lightning,
        threshold="False",
        source="NASA LLCC Rule 1"
    )


def rule_precipitation(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = not weather.precipitation
    return RuleResult(
        name="Precipitation",
        passed=passed,
        value=weather.precipitation,
        threshold="False",
        source="NASA LLCC Rule 5"
    )


def rule_wind(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = weather.wind_speed_kts <= WIND_MAX_KTS
    return RuleResult(
        name="Wind Speed",
        passed=passed,
        value=weather.wind_speed_kts,
        threshold=f"≤ {WIND_MAX_KTS} kts",
        source="Atlas V LCC / NASA KSC"
    )


def rule_visibility(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = weather.visibility_mi >= VISIBILITY_MIN_MI
    return RuleResult(
        name="Visibility",
        passed=passed,
        value=weather.visibility_mi,
        threshold=f"≥ {VISIBILITY_MIN_MI} mi",
        source="NASA KSC Weather Rules"
    )


def rule_ceiling(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = weather.ceiling_ft >= CEILING_MIN_FT
    return RuleResult(
        name="Ceiling",
        passed=passed,
        value=weather.ceiling_ft,
        threshold=f"≥ {CEILING_MIN_FT} ft",
        source="Atlas V LCC"
    )


def rule_thunderstorm(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = not weather.thunderstorm_alert
    return RuleResult(
        name="Thunderstorm Alert",
        passed=passed,
        value=weather.thunderstorm_alert,
        threshold="False",
        source="NASA LLCC / 45th Weather Squadron"
    )


def rule_cme(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    now = datetime.utcnow()
    future_limit = now + timedelta(hours=CME_MIN_HOURS)

    count = 0

    for cme in space.cme_arrivals:
        arrival = datetime.fromisoformat(cme["arrival_time"].replace("Z", "+00:00"))
        if now <= arrival <= future_limit:
            count += 1

    passed = count == 0

    return RuleResult(
        name="CME Arrival",
        passed=passed,
        value=count,
        threshold=f"No CME within {CME_MIN_HOURS} hours",
        source="SWPC CME Watch"
    )


def rule_radio_blackout(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    threshold = int(RADIO_BLACKOUT_MAX[1:])
    passed = space.r_scale < threshold

    return RuleResult(
        name="Radio Blackout",
        passed=passed,
        value=space.r_scale,
        threshold=f"< {threshold}",
        source="NOAA R-Scale"
    )


def rule_geomagnetic(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    threshold = int(GEO_STORM_MAX[1:])
    passed = space.g_scale < threshold

    return RuleResult(
        name="Geomagnetic Storm",
        passed=passed,
        value=space.g_scale,
        threshold=f"< {threshold}",
        source="NOAA G-Scale"
    )


def rule_collision_crewed(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = orbital.collision_probability <= PC_CREWED_MAX

    return RuleResult(
        name="Crewed Collision Probability",
        passed=passed,
        value=orbital.collision_probability,
        threshold=f"≤ {PC_CREWED_MAX}",
        source="FAA 14 CFR §450.169(a)"
    )


def rule_collision_debris(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> RuleResult:
    passed = orbital.debris_collision_probability <= PC_DEBRIS_MAX

    return RuleResult(
        name="Debris Collision Probability",
        passed=passed,
        value=orbital.debris_collision_probability,
        threshold=f"≤ {PC_DEBRIS_MAX}",
        source="FAA 14 CFR §450.169(a)"
    )
    


def evaluate_all_rules(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> HardRulesResult:
    if weather is None:
        return HardRulesResult(passed=True, failed_rules=[], all_results=[])
    rules = [
        rule_lightning,
        rule_precipitation,
        rule_wind,
        rule_visibility,
        rule_ceiling,
        rule_thunderstorm,
        rule_cme,
        rule_radio_blackout,
        rule_geomagnetic,
        rule_collision_crewed,
        rule_collision_debris
    ]

    results = [rule(weather, space, orbital) for rule in rules]

    failures = [r for r in results if not r.passed]

    passed = len(failures) == 0

    return HardRulesResult(
        passed=passed,
        results=results,
        failures=failures
    )