import os
from typing import List

import numpy as np
import xgboost as xgb
from pydantic import BaseModel

from data_fetchers.weather import WeatherData
from data_fetchers.space_weather import SpaceWeatherData
from data_fetchers.orbital import OrbitalData
from config import (
    WIND_MAX_KTS,
    VISIBILITY_MIN_MI,
    CEILING_MIN_FT,
    GEO_STORM_MAX,
    RADIO_BLACKOUT_MAX,
    PC_CREWED_MAX,
)

MODEL_PATH = "data/model.json"


class MLResult(BaseModel):
    anomaly_flag: bool
    confidence: float
    flagged_features: list[str]
    raw_probability: float


# Feature Extraction

def extract_features(
    weather: WeatherData,
    space: SpaceWeatherData,
    orbital: OrbitalData
) -> List[float]:

    return [
        weather.wind_speed_kts,
        weather.visibility_mi or 0.0,
        weather.ceiling_ft or 0.0,
        weather.temp_f or 0.0,
        int(weather.precipitation),
        int(weather.lightning),
        int(weather.thunderstorm_alert),
        space.kp_index,
        space.g_scale,
        space.s_scale,
        space.r_scale,
        space.m_class_probability,
        space.x_class_probability,
        orbital.object_count_near_orbit,
        orbital.collision_probability,
    ]


# Model Training

def train_model(X: List[List[float]], y: List[int]) -> xgb.XGBClassifier:

    os.makedirs("data", exist_ok=True)

    model = xgb.XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )

    model.fit(X, y)

    model.save_model(MODEL_PATH)

    return model


# Model Loading

def load_model() -> xgb.XGBClassifier:

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("Model file data/model.json not found")

    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)

    return model


# Prediction


def predict(
    weather: WeatherData,
    space: SpaceWeatherData,
    orbital: OrbitalData,
    model: xgb.XGBClassifier,
) -> MLResult:

    features = extract_features(weather, space, orbital)

    X = np.array([features])

    probability = float(model.predict_proba(X)[0][1])

    anomaly_flag = probability > 0.6

    confidence = probability if anomaly_flag else (1 - probability)

    flagged_features: list[str] = []

    # Weather thresholds
    if weather.wind_speed_kts > WIND_MAX_KTS:
        flagged_features.append("wind_speed_kts")

    if weather.visibility_mi and weather.visibility_mi < VISIBILITY_MIN_MI:
        flagged_features.append("visibility_mi")

    if weather.ceiling_ft and weather.ceiling_ft < CEILING_MIN_FT:
        flagged_features.append("ceiling_ft")

    if weather.precipitation:
        flagged_features.append("precipitation")

    if weather.lightning:
        flagged_features.append("lightning")

    if weather.thunderstorm_alert:
        flagged_features.append("thunderstorm_alert")

    # Space weather thresholds
    if space.g_scale >= int(GEO_STORM_MAX[1:]):
        flagged_features.append("g_scale")

    if space.r_scale >= int(RADIO_BLACKOUT_MAX[1:]):
        flagged_features.append("r_scale")

    if space.kp_index >= 6:
        flagged_features.append("kp_index")

    if space.m_class_probability > 0.5:
        flagged_features.append("m_class_probability")

    if space.x_class_probability > 0.2:
        flagged_features.append("x_class_probability")

    # Orbital congestion thresholds
    if orbital.object_count_near_orbit > 50:
        flagged_features.append("object_count_near_orbit")

    if orbital.collision_probability > PC_CREWED_MAX:
        flagged_features.append("collision_probability")

    return MLResult(
        anomaly_flag=anomaly_flag,
        confidence=confidence,
        flagged_features=flagged_features,
        raw_probability=probability,
    )