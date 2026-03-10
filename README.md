Rocket Launch Risk Assessment System
SENTINEL is a real-time launch risk assessment platform that aggregates live atmospheric, space weather, and orbital data through a three-branch parallel pipeline to produce GO / CAUTION / HOLD / NO-GO decisions.

Architecture
SENTINEL
         Branch 1 — Hard Rules       NASA/FAA/NOAA rule engine (11 rules, binary pass/fail)
         Branch 2 — Soft Scoring     Weighted domain scoring (atmospheric / space / orbital)
         Branch 3 — ML Detection     XGBoost anomaly detection
         
Aggregator → Decision → Report
Data Sources (all free, no paid APIs)
SourceDataNOAA NWSUS atmospheric conditionsOpen-MeteoGlobal atmospheric conditionsNOAA SWPCKp index, G/S/R scales, CME alertsNASA DONKISolar flare probabilitiesCelesTrakActive TLE catalog (orbital debris)

Tech Stack
Backend: Python 3.11+, FastAPI, XGBoost, httpx, Pydantic, SGP4
Frontend: React 18, Vite, Framer Motion, Recharts, React Query, Zustand

Setup
Prerequisites

Python 3.11+
Node.js 18+
NASA API key (free at https://api.nasa.gov)

Backend
bashcd sentinel
pip install -r requirements.txt
cp .env.example .env
# Add your NASA_API_KEY to .env
uvicorn api:app --reload
Frontend
bashcd sentinel-ui
npm install
npm run dev
Open http://localhost:5173

API Endpoints
EndpointMethodDescription/statusGETLive API health check/weatherGETCurrent atmospheric + space + orbital snapshot/assessPOSTFull launch risk assessment
Example Assessment Request
bashcurl -X POST http://localhost:8000/assess \
  -H "Content-Type: application/json" \
  -d '{
    "site_lat": 13.7199,
    "site_lng": 80.2304,
    "launch_time": "2026-03-20T10:00:00",
    "orbit_alt_km": 500,
    "vehicle": "PSLV-C60"
  }'

Decision Logic
DecisionConditionNO-GOAny hard rule fails (absolute veto)HOLDScore < 50CAUTIONScore 50–74 or branch disagreementGOAll hard rules pass + score ≥ 75
Score can be 100/100 with a NO-GO — this means perfect conditions but one absolute rule violation (e.g. active CME).

Hard Rules (Branch 1)
All sourced from official range safety documentation:

Lightning (NASA LLCC Rule 1)
Precipitation (NASA LLCC Rule 5)
Wind Speed ≤ 33 kts (Atlas V LCC / NASA KSC)
Visibility ≥ 4 mi (NASA KSC Weather Rules)
Ceiling ≥ 6000 ft (Atlas V LCC)
Thunderstorm Alert (NASA LLCC / 45th Weather Squadron)
CME Arrival within 6 hours (NOAA SWPC)
Radio Blackout < R3 (NOAA R-Scale)
Geomagnetic Storm < G4 (NOAA G-Scale)
Crewed Collision Probability ≤ 1e-6 (FAA 14 CFR §450.169(a))
Debris Collision Probability ≤ 1e-5 (FAA 14 CFR §450.169(a))


Environment Variables
NASA_API_KEY=your_key_here
Never commit .env. Use .env.example as a template.

Default Launch Site
SDSC Sriharikota, India (13.7199°N, 80.2304°E)
Any latitude/longitude can be passed in the /assess request body.


Known Limitations

ML model trained on synthetic data (real NASA/ISRO launch history deferred)
Collision probability uses physics-based cross-section model, not real CDM covariance matrices
All vehicles use the same LCC rules (vehicle-specific rules not yet implemented)



Built With
Live government data from NOAA, NASA, and CelesTrak. No paid APIs required.
