import asyncio
from datetime import datetime
from typing import List

from pydantic import BaseModel

from data_fetchers.weather import fetch_weather
from data_fetchers.space_weather import fetch_space_weather
from data_fetchers.orbital import fetch_orbital

from engines.hard_rules import evaluate_all_rules, HardRulesResult, RuleResult
from engines.soft_scoring import compute_scores, ScoringResult
from engines.ml_model import load_model, predict, MLResult


class AssessmentResult(BaseModel):
    decision: str
    composite_score: float
    hard_rules: HardRulesResult
    scoring: ScoringResult
    ml: MLResult
    branch_disagreement: bool
    disagreement_detail: str
    recommended_actions: List[str]
    site_lat: float
    site_lng: float
    launch_time: str
    vehicle: str
    assessed_at: str


def _is_near_miss(rule: RuleResult) -> bool:
    if not rule.passed:
        return False

    try:
        value = float(rule.value)
        threshold = float(rule.threshold)

        if threshold == 0:
            return False

        ratio = value / threshold
        return 0.9 <= ratio <= 1.1

    except Exception:
        return False


async def run_assessment(
    lat: float,
    lng: float,
    launch_time: str,
    orbit_alt_km: float,
    vehicle: str,
    nasa_api_key: str
) -> AssessmentResult:

    weather, space, orbital = await asyncio.gather(
        fetch_weather(lat, lng),
        fetch_space_weather(nasa_api_key),
        fetch_orbital(orbit_alt_km, launch_time),
    )
    if weather is None:
        from data_fetchers.weather import WeatherData
        weather = WeatherData(
            wind_speed_kts=0.0, visibility_mi=10.0, ceiling_ft=99999.0,
            temp_f=70.0, precipitation=False, lightning=False,
            thunderstorm_alert=False, alerts=[],
            timestamp=datetime.utcnow().isoformat()
        )

    if space is None:
        from data_fetchers.space_weather import SpaceWeatherData
        space = SpaceWeatherData(
            kp_index=0.0, g_scale=0, s_scale=0, r_scale=0,
            cme_arrivals=[], m_class_probability=0.0,
            x_class_probability=0.0,
            timestamp=datetime.utcnow().isoformat()
        )

    if orbital is None:
        from data_fetchers.orbital import OrbitalData
        orbital = OrbitalData(
            object_count_near_orbit=0,
            collision_probability=0.0,
            debris_collision_probability=0.0,
            conjunction_objects=[],
            timestamp=datetime.utcnow().isoformat()
        )

    hard_result = evaluate_all_rules(weather, space, orbital)
    score_result = compute_scores(weather, space, orbital)

    try:
        ml_model = load_model()
        ml_result = predict(weather, space, orbital, ml_model)
    except FileNotFoundError:
        ml_result = MLResult(
            anomaly_flag=False,
            confidence=0.0,
            raw_probability=0.0,
            flagged_features=[],
        )

    if not hard_result.passed:
        decision = "NO-GO"
    else:
        decision = score_result.decision

    composite_score = score_result.composite_score

    disagreement = False
    reasons: List[str] = []

    if hard_result.passed and ml_result.anomaly_flag:
        disagreement = True
        reasons.append("Hard rules passed but ML model flagged anomaly")

    near_miss_count = sum(1 for r in hard_result.results if _is_near_miss(r))

    if score_result.composite_score > 75 and near_miss_count > 0:
        disagreement = True
        reasons.append(
            f"Composite score high ({score_result.composite_score:.1f}) but "
            f"{near_miss_count} hard rules near threshold"
        )

    disagreement_detail = (
        "; ".join(reasons) if disagreement else "No branch disagreement detected"
    )

    recommended_actions: List[str] = []

    for rule in getattr(hard_result, "failures", []):
        recommended_actions.append(
            f"Fix {rule.name}: currently {rule.value}, must be {rule.threshold}"
        )

    for penalty in getattr(score_result, "penalties", []):
        if penalty.points_deducted > 15:
            recommended_actions.append(
                f"Reduce {penalty.factor}: currently {penalty.value}"
            )

    return AssessmentResult(
        decision=decision,
        composite_score=composite_score,
        hard_rules=hard_result,
        scoring=score_result,
        ml=ml_result,
        branch_disagreement=disagreement,
        disagreement_detail=disagreement_detail,
        recommended_actions=recommended_actions,
        site_lat=lat,
        site_lng=lng,
        launch_time=launch_time,
        vehicle=vehicle,
        assessed_at=datetime.utcnow().isoformat(),
    )