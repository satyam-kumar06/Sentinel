import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const MonitorPage = () => {
  const [timeAgo, setTimeAgo] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const { data, isLoading, isError, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ['weather'],
    queryFn: () => axios.get('/weather').then(res => res.data),
    refetchInterval: 60000,
    retry: false,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  useEffect(() => {
    const id = setInterval(() => {
      if (lastUpdated) {
        const secs = Math.floor((Date.now() - lastUpdated) / 1000);
        if (secs < 60) setTimeAgo(`${secs}s ago`);
        else setTimeAgo(`${Math.floor(secs / 60)}m ago`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const mono = { fontFamily: 'IBM Plex Mono, monospace' };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh', ...mono, fontSize: 13, color: '#00e5ff', letterSpacing: 4 }}>
      FETCHING SENSOR DATA...
    </div>
  );

  if (isError) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh', ...mono, fontSize: 13, color: '#ff3d5a', letterSpacing: 4 }}>
      DATA UNAVAILABLE — BACKEND OFFLINE
    </div>
  );

  // Safe destructure — any of these can be null if that API failed
  const weather = data?.weather ?? {};
  const space = data?.space_weather ?? {};
  const orbital = data?.orbital ?? {};

  const sortedCme = (space?.cme_arrivals ?? []).sort(
    (a, b) => new Date(a.arrival_time) - new Date(b.arrival_time)
  );

  // ── color helpers ──
  const windColor = (v) => v == null ? '#3d5570' : v < 20 ? '#29ffa0' : v <= 28 ? '#ffd426' : v <= 33 ? '#ff6d35' : '#ff3d5a';
  const visColor  = (v) => v == null ? '#3d5570' : v < 4 ? '#ff3d5a' : v <= 6 ? '#ff6d35' : '#29ffa0';
  const ceilColor = (v) => v == null ? '#3d5570' : v < 6000 ? '#ff3d5a' : v <= 8000 ? '#ff6d35' : '#29ffa0';
  const tempColor = (v) => v == null ? '#3d5570' : (v < 40 || v > 95) ? '#ff6d35' : '#29ffa0';
  const kpColor   = (v) => v == null ? '#3d5570' : v <= 3 ? '#29ffa0' : v === 4 ? '#ffd426' : v <= 6 ? '#ff6d35' : '#ff3d5a';
  const kpLabel   = (v) => v == null ? '—' : v <= 3 ? 'QUIET' : v === 4 ? 'UNSETTLED' : v <= 6 ? 'STORM' : 'SEVERE STORM';
  const scaleColor= (v) => v == null ? '#3d5570' : v === 0 ? '#29ffa0' : v <= 2 ? '#ffd426' : v === 3 ? '#ff6d35' : '#ff3d5a';
  const objColor  = (v) => v == null ? '#3d5570' : v < 30 ? '#29ffa0' : v <= 60 ? '#ffd426' : v <= 100 ? '#ff6d35' : '#ff3d5a';

  const card = { background: '#090d12', border: '1px solid #162030', padding: 20 };
  const cardTitle = { ...mono, fontSize: 9, letterSpacing: 4, color: '#3d5570', textTransform: 'uppercase', marginBottom: 12, display: 'block' };
  const bigNum = (color) => ({ ...mono, fontSize: 36, fontWeight: 600, color: color || '#3d5570', lineHeight: 1 });
  const unit = { ...mono, fontSize: 11, color: '#3d5570', marginLeft: 6 };
  const sectionTitle = { ...mono, fontSize: 10, letterSpacing: 5, color: '#3d5570', textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 };

  const na = (val, unit_str) => val == null
    ? <span style={{ ...mono, fontSize: 22, color: '#1f3045' }}>N/A</span>
    : <><span style={bigNum(null)}>{val}</span><span style={unit}>{unit_str}</span></>;

  return (
    <div style={{ background: '#05080b', minHeight: '100vh', padding: 32 }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
          Weather Monitor
        </h1>
        <span style={{ ...mono, fontSize: 10, color: '#3d5570', letterSpacing: 3 }}>
          SDSC SRIHARIKOTA · 13.7199°N · 80.2304°E
        </span>
      </div>
            <div style={{ height: 1, background: '#162030', marginBottom: 32 }} />

            {/* ── SECTION 1: ATMOSPHERIC ── */}
            <div style={sectionTitle}>
              <span>Atmospheric Conditions</span>
              <div style={{ flex: 1, height: 1, background: '#162030' }} />
            </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
        {/* Wind */}
        <div style={{ ...card, borderTop: `2px solid ${windColor(weather.wind_speed_kts)}` }}>
          <span style={cardTitle}>Wind Speed</span>
          <span style={bigNum(windColor(weather.wind_speed_kts))}>{weather.wind_speed_kts ?? '—'}</span>
          <span style={unit}>KTS</span>
          {weather.wind_speed_kts > 33 && (
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ marginTop: 8, ...mono, fontSize: 9, color: '#ff3d5a', letterSpacing: 2 }}>⚠ EXCEEDS LIMIT</motion.div>
          )}
        </div>

        {/* Visibility */}
        <div style={{ ...card, borderTop: `2px solid ${visColor(weather.visibility_mi)}` }}>
          <span style={cardTitle}>Visibility</span>
          <span style={bigNum(visColor(weather.visibility_mi))}>{weather.visibility_mi != null ? parseFloat(weather.visibility_mi).toFixed(1) : '—'}</span>
          <span style={unit}>MI</span>
        </div>

        {/* Ceiling */}
        <div style={{ ...card, borderTop: `2px solid ${ceilColor(weather.ceiling_ft)}` }}>
          <span style={cardTitle}>Ceiling</span>
          <span style={bigNum(ceilColor(weather.ceiling_ft))}>{weather.ceiling_ft != null ? Math.round(weather.ceiling_ft).toLocaleString() : '—'}</span>
          <span style={unit}>FT</span>
        </div>

        {/* Temp */}
        <div style={{ ...card, borderTop: `2px solid ${tempColor(weather.temp_f)}` }}>
          <span style={cardTitle}>Temperature</span>
         <span style={bigNum(tempColor(weather.temp_f))}>
          {weather.temp_f != null ? (((weather.temp_f - 32) * 5/9).toFixed(1)) : '—'}
        </span>
          <span style={unit}>°C</span>
        </div>

        {/* Precip */}
        <div style={{ ...card, borderTop: `2px solid ${weather.precipitation ? '#ff3d5a' : '#29ffa0'}` }}>
          <span style={cardTitle}>Precipitation</span>
          {weather.precipitation
            ? <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                style={{ ...mono, fontSize: 22, fontWeight: 600, color: '#ff3d5a' }}>ACTIVE</motion.span>
            : <span style={{ ...mono, fontSize: 22, fontWeight: 600, color: '#29ffa0' }}>NONE</span>
          }
        </div>

        {/* Lightning */}
        <div style={{ ...card, borderTop: `2px solid ${weather.lightning ? '#ff3d5a' : '#29ffa0'}` }}>
          <span style={cardTitle}>Lightning</span>
          {weather.lightning
            ? <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                style={{ ...mono, fontSize: 22, fontWeight: 600, color: '#ff3d5a' }}>DETECTED</motion.span>
            : <span style={{ ...mono, fontSize: 22, fontWeight: 600, color: '#29ffa0' }}>CLEAR</span>
          }
        </div>
      </div>

      {/* Alerts */}
      {(weather.alerts ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {weather.alerts.map((alert, i) => (
            <motion.div key={i} animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ background: 'rgba(255,61,90,0.1)', border: '1px solid rgba(255,61,90,0.4)', padding: '12px 20px', ...mono, fontSize: 12, color: '#ff3d5a', letterSpacing: 2 }}>
              ⚠ {alert}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── SECTION 2: SPACE WEATHER ── */}
      <div style={{ ...sectionTitle, marginTop: 36 }}>
        <span>Space Weather</span>
        <div style={{ flex: 1, height: 1, background: '#162030' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
        {/* LEFT: Kp + scales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Kp Bar */}
          <div style={card}>
            <span style={cardTitle}>Kp Index</span>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{ display: 'flex', height: 16 }}>
                {[1,2,3,4,5,6,7,8,9].map(i => (
                  <div key={i} style={{
                    flex: 1,
                    background: i <= 3 ? '#29ffa015' : i === 4 ? '#ffd42615' : i <= 6 ? '#ff6d3515' : '#ff3d5a15',
                    borderRight: '1px solid #162030',
                    position: 'relative',
                  }}>
                    {Math.floor(space.kp_index ?? -1) === i - 1 && (
                      <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 2, height: 20, background: kpColor(space.kp_index), boxShadow: `0 0 6px ${kpColor(space.kp_index)}` }} />
                    )}
                  </div>
                ))}
              </div>
              {/* Active segment highlight */}
              {space.kp_index != null && (
                <div style={{
                  position: 'absolute', top: 0, height: '100%',
                  width: `${(space.kp_index / 9) * 100}%`,
                  background: `${kpColor(space.kp_index)}20`,
                  pointerEvents: 'none'
                }} />
              )}
            </div>
            <div style={{ ...mono, fontSize: 28, fontWeight: 600, color: kpColor(space.kp_index) }}>
              {space.kp_index ?? '—'}
              <span style={{ ...mono, fontSize: 12, color: '#3d5570', marginLeft: 10 }}>
                {kpLabel(space.kp_index)}
              </span>
            </div>
          </div>

          {/* G/S/R Scales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {['g', 's', 'r'].map(s => (
              <div key={s} style={card}>
                <span style={cardTitle}>{s.toUpperCase()}-Scale</span>
                <span style={{ ...mono, fontSize: 32, fontWeight: 600, color: scaleColor(space[`${s}_scale`]) }}>
                  {space[`${s}_scale`] ?? '—'}
                </span>
                <span style={{ ...mono, fontSize: 10, color: '#3d5570', display: 'block', marginTop: 4 }}>
                  {s === 'g' ? 'Geomagnetic' : s === 's' ? 'Radiation' : 'Radio'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: CME + Flare */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* CME */}
          <div style={card}>
            <span style={cardTitle}>CME Arrivals</span>
            {sortedCme.length === 0
              ? <span style={{ ...mono, fontSize: 12, color: '#3d5570', letterSpacing: 2 }}>NO CME EVENTS DETECTED</span>
              : sortedCme.map((cme, i) => {
                  const arrival = new Date(cme.arrival_time)
                  const hrs = Math.max(0, (arrival - Date.now()) / 3600000).toFixed(1)
                  return (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #162030' }}>
                      <div style={{ ...mono, fontSize: 11, color: '#b8cfe0' }}>{arrival.toUTCString().slice(0, 25)}</div>
                      <div style={{ ...mono, fontSize: 10, color: '#3d5570', marginTop: 4 }}>
                        {cme.speed_kms ?? cme.speed ?? '?'} km/s &nbsp;·&nbsp;
                        <span style={{ color: parseFloat(hrs) < 6 ? '#ff3d5a' : '#ffd426' }}>{hrs}h until arrival</span>
                      </div>
                    </div>
                  )
                })
            }
          </div>

          {/* Flare Probability */}
          <div style={card}>
            <span style={cardTitle}>Solar Flare Probability</span>
            {[
              { label: 'M-class', val: space.m_class_probability, threshold: 50 },
              { label: 'X-class', val: space.x_class_probability, threshold: 20 },
            ].map(({ label, val, threshold }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ ...mono, fontSize: 11, color: '#3d5570' }}>{label}</span>
                  <span style={{ ...mono, fontSize: 16, fontWeight: 600, color: (val ?? 0) > threshold ? '#ff6d35' : '#29ffa0' }}>
                    {val != null ? `${val}%` : 'N/A'}
                  </span>
                </div>
                <div style={{ background: '#162030', height: 3 }}>
                  <div style={{ width: `${val ?? 0}%`, height: '100%', background: (val ?? 0) > threshold ? '#ff6d35' : '#29ffa0' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: ORBITAL ── */}
      <div style={{ ...sectionTitle, marginTop: 36 }}>
        <span>Orbital Environment</span>
        <div style={{ flex: 1, height: 1, background: '#162030' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        <div style={{ ...card, borderTop: `2px solid ${objColor(orbital.object_count_near_orbit)}` }}>
          <span style={cardTitle}>Objects Near Orbit</span>
          <span style={bigNum(objColor(orbital.object_count_near_orbit))}>
            {orbital.object_count_near_orbit ?? '—'}
          </span>
        </div>
        <div style={{ ...card, borderTop: `2px solid ${orbital.collision_probability < 1e-6 ? '#29ffa0' : '#ff3d5a'}` }}>
          <span style={cardTitle}>Collision Pc (Crewed)</span>
          <span style={bigNum(orbital.collision_probability < 1e-6 ? '#29ffa0' : '#ff3d5a')}>
            {orbital.collision_probability != null ? orbital.collision_probability.toExponential(1) : '—'}
          </span>
        </div>
        <div style={{ ...card, borderTop: `2px solid ${orbital.debris_collision_probability < 1e-5 ? '#29ffa0' : '#ff3d5a'}` }}>
          <span style={cardTitle}>Debris Pc</span>
          <span style={bigNum(orbital.debris_collision_probability < 1e-5 ? '#29ffa0' : '#ff3d5a')}>
            {orbital.debris_collision_probability != null ? orbital.debris_collision_probability.toExponential(1) : '—'}
          </span>
        </div>
      </div>

    </div>
  );
};

export default MonitorPage;