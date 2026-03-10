# ATMOSPHERIC HARD RULES
WIND_MAX_KTS = 33          # Atlas V LCC / NASA KSC Weather Rules
VISIBILITY_MIN_MI = 4      # Range Safety / NASA KSC Weather Rules
CEILING_MIN_FT = 6000      # Atlas V LCC
# (lightning, precipitation, thunderstorm = boolean flags, any = NO-GO)

# SPACE WEATHER HARD RULES
CME_MIN_HOURS = 6          # SWPC CME Watch Procedures
RADIO_BLACKOUT_MAX = "R3"  # NOAA R-Scale
GEO_STORM_MAX = "G4"       # NOAA G-Scale

# ORBITAL HARD RULES
PC_CREWED_MAX = 1e-6       # FAA 14 CFR § 450.169(a)
PC_DEBRIS_MAX = 1e-5       # FAA 14 CFR § 450.169(a)

# SOFT SCORING PENALTIES
SOFT_SCORING_PENALTIES = [

    # ATMOSPHERIC FACTORS
    {"factor": "wind", "min": 20, "max": 28, "penalty": -15, "domain": "atmospheric"},
    {"factor": "wind", "min": 28, "max": 33, "penalty": -25, "domain": "atmospheric"},

    {"factor": "ceiling", "min": 8000, "max": 10000, "penalty": -10, "domain": "atmospheric"},
    {"factor": "ceiling", "min": 6000, "max": 8000, "penalty": -20, "domain": "atmospheric"},

    {"factor": "visibility", "min": 4, "max": 6, "penalty": -10, "domain": "atmospheric"},

    {"factor": "temperature_low", "max": 40, "penalty": -5, "domain": "atmospheric"},
    {"factor": "temperature_high", "min": 95, "penalty": -5, "domain": "atmospheric"},

    # SPACE WEATHER FACTORS
    {"factor": "kp_index", "min": 5, "max": 6, "penalty": -12, "domain": "space_weather"},

    {"factor": "geomagnetic_storm", "level": ["G1","G2"], "penalty": -10, "domain": "space_weather"},
    {"factor": "geomagnetic_storm", "level": ["G3"], "penalty": -20, "domain": "space_weather"},

    {"factor": "radio_blackout", "level": ["R2"], "penalty": -8, "domain": "space_weather"},

    {"factor": "solar_flare_prob", "min": 0.5, "penalty": -8, "domain": "space_weather"},

    # ORBITAL FACTORS
    {"factor": "near_orbit_objects", "min": 30, "max": 60, "penalty": -5, "domain": "orbital"},
    {"factor": "near_orbit_objects", "min": 60, "max": 100, "penalty": -15, "domain": "orbital"},
]


# DOMAIN WEIGHTS (must sum to 1.0)
WEIGHT_ATMOSPHERIC = 0.40
WEIGHT_SPACE_WEATHER = 0.35
WEIGHT_ORBITAL = 0.25

# DECISION THRESHOLDS
SCORE_GO = 80
SCORE_CAUTION_MIN = 50
# below 50 = HOLD, any hard rule fail = NO-GO regardless of score

# API ENDPOINTS
NWS_BASE = "https://api.weather.gov"
DONKI_BASE = "https://api.nasa.gov/DONKI"
SWPC_BASE = "https://services.swpc.noaa.gov"
CELESTRAK_BASE = "https://celestrak.org"
