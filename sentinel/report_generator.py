from aggregator import AssessmentResult


def generate_report(result: AssessmentResult) -> str:

    hard_results = result.hard_rules.results
    hard_failures = result.hard_rules.failures

    total_rules = len(hard_results)
    failed_count = len(hard_failures)

    failed_rules = [r for r in hard_results if not r.passed]
    passed_rules = [r for r in hard_results if r.passed]

    rule_lines = []

    for rule in failed_rules:
        rule_lines.append(
            f">>FAIL | {rule.name} | {rule.value} | {rule.threshold} | {rule.source}"
        )

    for rule in passed_rules:
        rule_lines.append(
            f"PASS  | {rule.name} | {rule.value} | {rule.threshold} | {rule.source}"
        )

    hard_rules_section = "\n".join(rule_lines)

    atm_score = result.scoring.atmospheric_score
    space_score = result.scoring.space_weather_score
    orbital_score = result.scoring.orbital_score
    composite_score = result.scoring.composite_score

    if result.scoring.penalties:
        penalties_lines = [
            f"  -{p.points_deducted} pts | {p.factor} | {p.value}"
            for p in result.scoring.penalties
        ]
        penalties_text = "\n".join(penalties_lines)
    else:
        penalties_text = "None"

    anomaly_text = "YES" if result.ml.anomaly_flag else "NO"
    confidence_pct = int(result.ml.confidence * 100)

    flagged_features = (
        ", ".join(result.ml.flagged_features)
        if result.ml.flagged_features
        else "None"
    )

    if result.decision == "GO":
        actions_text = "No action required. Cleared for launch."
    else:
        if result.recommended_actions:
            actions = [
                f"{i+1}. {action}"
                for i, action in enumerate(result.recommended_actions)
            ]
            actions_text = "\n".join(actions)
        else:
            actions_text = "None"

    report = f"""═══════════════════════════════════════════════════════════
SENTINEL RISK ASSESSMENT
Site: {result.site_lat}, {result.site_lng} | Vehicle: {result.vehicle}
Window: {result.launch_time} | Assessed: {result.assessed_at}
═══════════════════════════════════════════════════════════

DECISION:   {result.decision}
RISK SCORE: {result.composite_score}/100
───────────────────────────────────────────────────────────
HARD RULES (Branch 1) — {failed_count} failure(s) / {total_rules} rules
───────────────────────────────────────────────────────────
{hard_rules_section}

───────────────────────────────────────────────────────────
DOMAIN SCORES (Branch 2)
───────────────────────────────────────────────────────────
ATMOSPHERIC:   {atm_score}/100
SPACE WEATHER: {space_score}/100
ORBITAL:       {orbital_score}/100
COMPOSITE:     {composite_score}/100

Penalties:
{penalties_text}

───────────────────────────────────────────────────────────
ML PATTERN DETECTION (Branch 3)
───────────────────────────────────────────────────────────
ANOMALY FLAG: {anomaly_text} | Confidence: {confidence_pct}%
Flagged features: {flagged_features}

───────────────────────────────────────────────────────────
RECOMMENDED ACTIONS
───────────────────────────────────────────────────────────
{actions_text}
═══════════════════════════════════════════════════════════"""

    return report