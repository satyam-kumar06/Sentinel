from pydantic import BaseModel
from typing import Any

from config import (
    WEIGHT_ATMOSPHERIC,
    WEIGHT_SPACE_WEATHER,
    WEIGHT_ORBITAL
)

from data_fetchers.weather import WeatherData
from data_fetchers.space_weather import SpaceWeatherData
from data_fetchers.orbital import OrbitalData


class args(BaseModel):
    factor: str
    value: Any
    points_deducted: int
    domain: str   # atmospheric | space_weather | orbital


class ScoringResult(BaseModel):
    atmospheric_score: float
    space_weather_score: float
    orbital_score: float
    composite_score: float
    penalties: list[args]
    decision: str   # GO | CAUTION | HOLD


def compute_scores(weather: WeatherData, space: SpaceWeatherData, orbital: OrbitalData) -> ScoringResult:
    if weather is None:
        weather = type('W', (), {'wind_speed_kts':0,'visibility_mi':10,'ceiling_ft':99999,'temp_f':70,'precipitation':False,'lightning':False,'thunderstorm_alert':False,'alerts':[]})()
    penalties: list[args] = []

    
    # ATMOSPHERIC
    

    atmospheric_deductions = 0


    wind = float(weather.wind_speed_kts or 0)
    if 20 <= wind <= 28:
        penalties.append(args(factor="Wind 20–28 kts", value=wind, points_deducted=15, domain="atmospheric"))
        atmospheric_deductions += 15
    elif 28 < wind <= 33:
        penalties.append(args(factor="Wind 28–33 kts", value=wind, points_deducted=25, domain="atmospheric"))
        atmospheric_deductions += 25

    ceiling = float(weather.ceiling_ft or 99999)
    if 6000 <= ceiling <= 8000:
        penalties.append(args(factor="Ceiling 6000–8000 ft", value=ceiling, points_deducted=20, domain="atmospheric"))
        atmospheric_deductions += 20
    elif 8000 < ceiling <= 10000:
        penalties.append(args(factor="Ceiling 8000–10000 ft", value=ceiling, points_deducted=10, domain="atmospheric"))
        atmospheric_deductions += 10

    visibility = float(weather.visibility_mi or 10)
    if 4 <= visibility <= 6:
        penalties.append(args(factor="Visibility 4–6 mi", value=visibility, points_deducted=10, domain="atmospheric"))
        atmospheric_deductions += 10

    temp = float(weather.temp_f or 70)
    if temp < 40 or temp > 95:
        penalties.append(args(factor="Temperature extreme", value=temp, points_deducted=5, domain="atmospheric"))
        atmospheric_deductions += 5

    atmospheric_score = max(0, 100 - atmospheric_deductions)
    space_deductions = 0
    orbital_deductions = 0

    kp = float(space.kp_index or 0)
    if 5 <= kp <= 6:
        penalties.append(args(factor="Kp 5–6", value=kp, points_deducted=12, domain="space_weather"))
        space_deductions += 12

    g = int(space.g_scale or 0)
    if 1 <= g <= 2:
        penalties.append(args(factor="G1–G2 storm", value=g, points_deducted=10, domain="space_weather"))
        space_deductions += 10
    elif g == 3:
        penalties.append(args(factor="G3 storm", value=g, points_deducted=20, domain="space_weather"))
        space_deductions += 20

    r = int(space.r_scale or 0)
    if r == 2:
        penalties.append(args(factor="R2 blackout", value=r, points_deducted=8, domain="space_weather"))
        space_deductions += 8

    m_prob = float(space.m_class_probability or 0)
    if m_prob > 0.50:
        penalties.append(args(factor="M-class probability > 50%", value=m_prob, points_deducted=8, domain="space_weather"))
        space_deductions += 8

    space_weather_score = max(0, 100 - space_deductions)

    objects = int(orbital.object_count_near_orbit or 0)
    if 30 <= objects <= 60:
        penalties.append(args(factor="30–60 objects near orbit", value=objects, points_deducted=5, domain="orbital"))
        orbital_deductions += 5
    elif 60 < objects <= 100:
        penalties.append(args(factor="60–100 objects near orbit", value=objects, points_deducted=15, domain="orbital"))
        orbital_deductions += 15

    orbital_score = max(0, 100 - orbital_deductions)

    
    # COMPOSITE SCORE
    

    composite_score = (
        atmospheric_score * WEIGHT_ATMOSPHERIC
        + space_weather_score * WEIGHT_SPACE_WEATHER
        + orbital_score * WEIGHT_ORBITAL
    )

    
    # DECISION
    

    if composite_score >= 80:
        decision = "GO"
    elif composite_score >= 50:
        decision = "CAUTION"
    else:
        decision = "HOLD"

    return ScoringResult(
        atmospheric_score=atmospheric_score,
        space_weather_score=space_weather_score,
        orbital_score=orbital_score,
        composite_score=composite_score,
        penalties=penalties,
        decision=decision
    )