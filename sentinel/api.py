import asyncio
import sqlite3
import traceback
import json
import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional, List

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from aggregator import run_assessment, AssessmentResult
from report_generator import generate_report
from engines.ml_model import load_model
from data_fetchers.weather import fetch_weather
from data_fetchers.space_weather import fetch_space_weather
from data_fetchers.orbital import fetch_orbital

# Load environment variables
load_dotenv()
NASA_API_KEY = os.getenv("NASA_API_KEY", "")

# Logger
logger = logging.getLogger(__name__)

# Constants
DATABASE_PATH = "sentinel.db"
KSC_LAT = 28.5729
KSC_LNG = -80.6490

# Global state
ml_model = None
db_conn = None


class LaunchInput(BaseModel):
    site_lat: float
    site_lng: float
    launch_time: str      # ISO format UTC
    orbit_alt_km: float
    vehicle: str


class HistoryRecord(BaseModel):
    id: int
    assessed_at: str
    site_lat: float
    site_lng: float
    vehicle: str
    decision: str
    composite_score: float


class StatusResponse(BaseModel):
    nws: str
    swpc: str
    donki: str
    celestrak: str


def _init_database():
    """Initialize SQLite database and create table if needed."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessed_at TEXT NOT NULL,
            site_lat REAL NOT NULL,
            site_lng REAL NOT NULL,
            vehicle TEXT NOT NULL,
            launch_time TEXT NOT NULL,
            decision TEXT NOT NULL,
            composite_score REAL NOT NULL,
            full_json TEXT NOT NULL
        )
    """)
    
    conn.commit()
    return conn


def _save_assessment(conn: sqlite3.Connection, result: AssessmentResult):
    """Save assessment result to SQLite."""
    cursor = conn.cursor()
    
    full_json = json.dumps(result.model_dump(), default=str)
    
    cursor.execute("""
        INSERT INTO assessments 
        (assessed_at, site_lat, site_lng, vehicle, launch_time, decision, composite_score, full_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        result.assessed_at,
        result.site_lat,
        result.site_lng,
        result.vehicle,
        result.launch_time,
        result.decision,
        result.composite_score,
        full_json
    ))
    
    conn.commit()


async def _check_api_health(url: str, timeout: int = 5) -> str:
    """Check health of an external API."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.head(url, follow_redirects=True)
            if response.status_code < 500:
                return "ok"
            return "degraded"
    except Exception as e:
        logger.warning(f"API health check failed for {url}: {e}")
        return "down"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager for startup/shutdown."""
    global ml_model, db_conn
    
    # Startup
    logger.info("SENTINEL API starting up...")
    
    # Load ML model
    try:
        ml_model = load_model()
        logger.info("ML model loaded successfully")
    except Exception as e:
        logger.warning(f"Failed to load ML model: {e}")
        ml_model = None
    
    # Initialize database
    try:
        db_conn = _init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        db_conn = None
    
    yield
    
    # Shutdown
    logger.info("SENTINEL API shutting down...")
    if db_conn:
        db_conn.close()


# FastAPI app
app = FastAPI(
    title="SENTINEL",
    description="Launch Readiness Assessment System",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/assess", response_model=dict)
async def assess_launch(launch_input: LaunchInput):
    """
    Assess launch readiness.
    
    Runs all three assessment branches (hard rules, soft scoring, ML model)
    and saves result to database.
    """
    if not db_conn:
        return {"error": "Database not available"}
    
    if not NASA_API_KEY:
        return {"error": "NASA_API_KEY not configured"}
    
    try:
        result = await run_assessment(
            lat=launch_input.site_lat,
            lng=launch_input.site_lng,
            launch_time=launch_input.launch_time,
            orbit_alt_km=launch_input.orbit_alt_km,
            vehicle=launch_input.vehicle,
            nasa_api_key=NASA_API_KEY
        )
        
        # Save to database
        _save_assessment(db_conn, result)
        
        # Generate report
        report = generate_report(result)
        
        return {
            "assessment": result.model_dump(),
            "report": report
        }
    
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Assessment failed: {e}")
        return {"error": str(e)}


@app.get("/weather", response_model=dict)
async def get_weather(lat: float = 13.7199, lng: float = 80.2304):
    """
    Get current weather and space weather snapshot.
    
    Returns combined data from all three data fetchers in parallel.
    Defaults to Kennedy Space Center if no coordinates provided.
    """
    query_lat = lat if lat is not None else KSC_LAT
    query_lng = lng if lng is not None else KSC_LNG
    
    try:
        weather, space, orbital = await asyncio.gather(
            fetch_weather(query_lat, query_lng),
            fetch_space_weather(NASA_API_KEY),
            fetch_orbital(100.0, datetime.utcnow().isoformat()),  # Default alt=100km, current time
            return_exceptions=True
        )
        
        result = {
            "site_lat": query_lat,
            "site_lng": query_lng,
            "snapshot_time": datetime.utcnow().isoformat(),
        }
        
        if isinstance(weather, Exception):
            result["weather"] = {"error": str(weather)}
        else:
            result["weather"] = weather.model_dump() if weather else None
        
        if isinstance(space, Exception):
            result["space_weather"] = {"error": str(space)}
        else:
            result["space_weather"] = space.model_dump() if space else None
        
        if isinstance(orbital, Exception):
            result["orbital"] = {"error": str(orbital)}
        else:
            result["orbital"] = orbital.model_dump() if orbital else None
        
        return result
    
    except Exception as e:
        logger.error(f"Weather snapshot failed: {e}")
        return {"error": str(e)}


@app.get("/history", response_model=list[HistoryRecord])
async def get_history():
    """
    Retrieve last 50 assessments ordered by assessed_at DESC.
    """
    if not db_conn:
        return []
    
    try:
        cursor = db_conn.cursor()
        cursor.execute("""
            SELECT id, assessed_at, site_lat, site_lng, vehicle, decision, composite_score
            FROM assessments
            ORDER BY assessed_at DESC
            LIMIT 50
        """)
        
        rows = cursor.fetchall()
        return [
            HistoryRecord(
                id=row[0],
                assessed_at=row[1],
                site_lat=row[2],
                site_lng=row[3],
                vehicle=row[4],
                decision=row[5],
                composite_score=row[6]
            )
            for row in rows
        ]
    
    except Exception as e:
        logger.error(f"History retrieval failed: {e}")
        return []


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """
    Check health status of all external APIs.
    """
    nws_status, swpc_status, donki_status, celestrak_status = await asyncio.gather(
        _check_api_health("https://api.weather.gov/gridpoints/TBW/78,34"),  # NWS example endpoint
        _check_api_health("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"),
        _check_api_health("https://api.nasa.gov/"),
        _check_api_health("https://celestrak.com/"),
    )
    
    return StatusResponse(
        nws=nws_status,
        swpc=swpc_status,
        donki=donki_status,
        celestrak=celestrak_status
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "SENTINEL",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "POST /assess",
            "GET /weather",
            "GET /history",
            "GET /status",
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
