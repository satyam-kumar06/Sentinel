import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const LAUNCH_SITES = [
  
  { label: 'Satish Dhawan Space Centre (SDSC SHAR) — Sriharikota', lat: 13.7199, lng: 80.2304, country: 'ISRO' },
  { label: 'Abdul Kalam Island (Wheeler Island) — Odisha', lat: 20.7572, lng: 87.0900, country: 'ISRO' },
  { label: 'Thumba Equatorial Rocket Launching Station (TERLS) — Kerala', lat: 8.5241, lng: 76.8960, country: 'ISRO' },
  { label: 'Challakere Spaceport — Karnataka', lat: 14.3173, lng: 76.6554, country: 'ISRO' },
  { label: 'Kennedy Space Center, FL', lat: 28.5729, lng: -80.6490, country: 'USA' },
  { label: 'Vandenberg SFB, CA', lat: 34.7420, lng: -120.5724, country: 'USA' },
  { label: 'Boca Chica TX — SpaceX Starbase', lat: 25.9969, lng: -97.1573, country: 'USA' },
  { label: 'Custom', lat: null, lng: null, country: null },
]

const LOADING_TEXTS = [
  'FETCHING WEATHER DATA...',
  'RUNNING HARD RULES...',
  'COMPUTING RISK SCORE...',
  'RUNNING ML MODEL...',
  'AGGREGATING RESULTS...',
]

const DECISION_STYLES = {
  'GO':      { color: '#29ffa0', icon: '✓', label: 'CLEARED FOR LAUNCH' },
  'CAUTION': { color: '#ffd426', icon: '⚠', label: 'ELEVATED RISK' },
  'HOLD':    { color: '#ff6d35', icon: '⏸', label: 'CONDITIONS UNACCEPTABLE' },
  'NO-GO':   { color: '#ff3d5a', icon: '✕', label: 'LAUNCH NOT APPROVED' },
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 6, color: '#3d5570', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: '#162030' }} />
    </div>
  )
}

function ArcGauge({ score, decisionColor }) {
  const size = 180
  const cx = size / 2
  const cy = size / 2 + 10
  const r = 70
  const startAngle = 225
  const endAngle = 315 // 270 degree sweep
  const toRad = d => (d * Math.PI) / 180

  const arcPath = (start, sweep) => {
    const startRad = toRad(start)
    const endRad = toRad(start + sweep)
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const largeArc = sweep > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const color =
  decisionColor ||
  (score < 50
    ? '#ff3d5a'
    : score < 80
    ? '#ffd426'
    : '#29ffa0')
  const sweep = (score / 100) * 270

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={arcPath(startAngle, 270)} fill="none" stroke="#162030" strokeWidth={10} strokeLinecap="butt" />
        <motion.path
          d={arcPath(startAngle, 270)}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="butt"
          strokeDasharray={2 * Math.PI * r * 0.75}
          initial={{ strokeDashoffset: 2 * Math.PI * r * 0.75 }}
          animate={{ strokeDashoffset: 2 * Math.PI * r * 0.75 * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={46} fontWeight={600} fill={color}>
          {score}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={12} fill="#3d5570">
          / 100
        </text>
      </svg>
    </div>
  )
}

function ConfidenceBar({ value, color = '#a78bfa' }) {
  return (
    <div style={{ background: '#162030', height: 4, width: '100%', marginTop: 8 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ height: '100%', background: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  )
}

function DomainBar({ label, score, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 3, color: '#3d5570', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 600, color }}>{score}</span>
      </div>
      <div style={{ background: '#162030', height: 4 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: color }}
        />
      </div>
    </div>
  )
}

function PenaltyPanel({ penalties }) {
  const [open, setOpen] = useState(false)
  const totalPts = penalties?.reduce((s, p) => s + p.points_deducted, 0) || 0
  const domainColor = { atmospheric: '#00e5ff', space_weather: '#ffd426', orbital: '#29ffa0' }

  return (
    <div style={{ background: '#090d12', border: '1px solid #162030' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', cursor: 'pointer' }}
      >
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 4, color: '#3d5570', textTransform: 'uppercase' }}>
          ACTIVE PENALTIES — {penalties?.length || 0} factors, -{totalPts} pts total
        </span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#3d5570' }}
        >▶</motion.span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 24px 20px' }}>
              {penalties?.length === 0 && (
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#3d5570' }}>NO ACTIVE PENALTIES</span>
              )}
              {penalties?.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #0d1520', gap: 12 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#b8cfe0', flex: 2 }}>{p.factor}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#3d5570', flex: 1 }}>{p.value}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#ff3d5a', fontWeight: 600, flex: 1 }}>−{p.points_deducted} pts</span>
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: 9, padding: '3px 10px',
                    background: `${domainColor[p.domain]}18`, color: domainColor[p.domain],
                    border: `1px solid ${domainColor[p.domain]}30`, letterSpacing: 2, textTransform: 'uppercase'
                  }}>
                    {p.domain === 'space_weather' ? 'SPACE' : p.domain?.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RawReport({ report }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: '#090d12', border: '1px solid #162030' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', cursor: 'pointer' }}
      >
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 4, color: '#3d5570', textTransform: 'uppercase' }}>
          FULL ASSESSMENT REPORT
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}
          style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#3d5570' }}>▶</motion.span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <pre style={{
              fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#4a6070',
              background: '#090d12', padding: '0 24px 24px', overflowX: 'auto',
              whiteSpace: 'pre-wrap', lineHeight: 1.8
            }}>
              {report || 'No report generated.'}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyState() {
  const boxes = ['DECISION', 'RISK SCORE', 'BRANCH ANALYSIS', 'PENALTIES']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 24 }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 64, color: '#1f3045', lineHeight: 1 }}>—</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: 5, color: '#3d5570', textTransform: 'uppercase' }}>
        AWAITING MISSION PARAMETERS
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
        {boxes.map(b => (
          <div key={b} style={{ background: '#090d12', border: '1px solid #162030', padding: '14px 20px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#1f3045', letterSpacing: 3, textTransform: 'uppercase' }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingState({ text }) {
  const boxes = ['DECISION', 'RISK SCORE', 'BRANCH ANALYSIS', 'PENALTIES']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, gap: 24 }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, letterSpacing: 3, color: '#00e5ff', textTransform: 'uppercase' }}
      >
        {text}
      </motion.div>
      <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
        {boxes.map(b => (
          <motion.div
            key={b}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 0.5 }}
            style={{ background: '#090d12', border: '1px solid #162030', padding: '14px 20px' }}
          >
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#1f3045', letterSpacing: 3, textTransform: 'uppercase' }}>{b}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function AssessPage() {
  const [selectedSite, setSelectedSite] = useState('')
  const [customLat, setCustomLat] = useState('')
  const [customLng, setCustomLng] = useState('')
  const [launchTime, setLaunchTime] = useState('')
  const [orbitAlt, setOrbitAlt] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [loadingText, setLoadingText] = useState(LOADING_TEXTS[0])
  const [penaltiesOpen, setPenaltiesOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [report, setReport] = useState(null)  
  

  const site = LAUNCH_SITES.find(s => s.label === selectedSite)
  const isCustom = selectedSite === 'Custom'

  const mutation = useMutation({
  mutationFn: (data) => axios.post('/assess', data).then(r => r.data),
  onSuccess: (data) => {
    setResult(data.assessment)
    setReport(data.report)
  },
})

  useEffect(() => {
    if (!mutation.isPending) return
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % LOADING_TEXTS.length
      setLoadingText(LOADING_TEXTS[i])
    }, 800)
    return () => clearInterval(id)
  }, [mutation.isPending])

  const handleSubmit = () => {
    const lat = isCustom ? parseFloat(customLat) : site?.lat
    const lng = isCustom ? parseFloat(customLng) : site?.lng
    if (!lat || !lng || !launchTime || !orbitAlt || !vehicle) return
    mutation.mutate({ site_lat: lat, site_lng: lng, launch_time: launchTime, orbit_alt_km: parseFloat(orbitAlt), vehicle })
  }

  const ds = result ? (DECISION_STYLES[result.decision] ?? DECISION_STYLES['HOLD']) : null
  // Normalize backend field names
  if (result) {
    result.composite_score = result.composite_score ?? result.scoring?.composite_score ?? 0
    result.hard_rules = result.hard_rules ?? result.branch_results?.hard_rules
    result.scoring = result.scoring ?? result.branch_results?.scoring
    result.ml = result.ml ?? result.branch_results?.ml
  }
  const inputStyle = {
    width: '100%', background: '#090d12', border: '1px solid #1f3045',
    color: '#b8cfe0', fontFamily: 'IBM Plex Mono', fontSize: 13,
    padding: '12px 16px', outline: 'none', boxSizing: 'border-box',
    colorScheme: 'dark',
  }
  const labelStyle = {
    display: 'block', fontFamily: 'IBM Plex Mono', fontSize: 9,
    letterSpacing: 3, color: '#3d5570', textTransform: 'uppercase', marginBottom: 8,
  }

  return (
    <div style={{ background: '#05080b', minHeight: '100vh', padding: 32, fontFamily: 'Syne, sans-serif' }}>

      {/* PAGE TITLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
          Launch Assessment
        </h1>
        {result?.assessed_at && (
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', letterSpacing: 2 }}>
            ASSESSED: {result.assessed_at}
          </span>
        )}
      </div>
      <div style={{ height: 1, background: '#162030', marginBottom: 28 }} />

      {/* TWO COLUMNS */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ width: 400, flexShrink: 0 }}>
          <SectionLabel>Mission Parameters</SectionLabel>

          {/* LAUNCH SITE */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Launch Site</label>
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">— Select Launch Site —</option>
              <optgroup label="── USA ──">
                {LAUNCH_SITES.filter(s => s.country === 'USA').map(s => (
                  <option key={s.label} value={s.label}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="── ISRO (India) ──">
                {LAUNCH_SITES.filter(s => s.country === 'ISRO').map(s => (
                  <option key={s.label} value={s.label}>{s.label}</option>
                ))}
              </optgroup>
              <option value="Custom">Custom Coordinates</option>
            </select>
          </div>

          {/* CUSTOM COORDS */}
          <AnimatePresence>
            {isCustom && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginBottom: 20, overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Latitude</label>
                    <input type="number" placeholder="28.5729" value={customLat}
                      onChange={e => setCustomLat(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Longitude</label>
                    <input type="number" placeholder="-80.6490" value={customLng}
                      onChange={e => setCustomLng(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LAUNCH TIME */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Launch Date & Time (UTC)</label>
            <input type="datetime-local" value={launchTime}
              onChange={e => setLaunchTime(e.target.value)} style={inputStyle} />
          </div>

          {/* ORBIT ALT */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Target Orbit Altitude</label>
            <div style={{ display: 'flex' }}>
              <input type="number" placeholder="400" value={orbitAlt}
                onChange={e => setOrbitAlt(e.target.value)}
                style={{ ...inputStyle, flex: 1 }} />
              <div style={{ background: '#0d1520', border: '1px solid #1f3045', borderLeft: 'none', padding: '12px 16px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#3d5570' }}>
                KM
              </div>
            </div>
          </div>

          {/* VEHICLE */}
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Vehicle</label>
            <input type="text" placeholder="e.g. Falcon 9, GSLV Mk III, PSLV-C60"
              value={vehicle} onChange={e => setVehicle(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ height: 1, background: '#162030', marginBottom: 28 }} />

          {/* BUTTON */}
          <motion.button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            whileHover={!mutation.isPending ? { backgroundColor: '#00e5ff', color: '#05080b' } : {}}
            whileTap={!mutation.isPending ? { scale: 0.99 } : {}}
            style={{
              width: '100%', background: 'transparent',
              border: `1px solid ${mutation.isPending ? '#1f3045' : '#00e5ff'}`,
              color: mutation.isPending ? '#3d5570' : '#00e5ff',
              fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: 5,
              textTransform: 'uppercase', padding: 16, cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {mutation.isPending ? loadingText : 'RUN ASSESSMENT'}
          </motion.button>

          {/* SITE COORDS DISPLAY */}
          {site && !isCustom && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#090d12', border: '1px solid #162030' }}>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', letterSpacing: 2 }}>
                {site.lat}° N &nbsp;·&nbsp; {site.lng}° {site.lng < 0 ? 'W' : 'E'}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!result && !mutation.isPending && <EmptyState />}
          {mutation.isPending && <LoadingState text={loadingText} />}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >

              {/* 1. DECISION BANNER */}
              <motion.div
                animate={result?.decision === 'NO-GO' ? { x: [-4, 4, -4, 4, 0] } : {}}
                transition={{ duration: 0.4, delay: 0.3 }}
                style={{
                  padding: '24px 32px',
                  background: `${ds.color}10`,
                  borderLeft: `4px solid ${ds.color}`,
                  border: `1px solid ${ds.color}30`,
                  borderLeftWidth: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 32, color: ds.color }}>{ds.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontSize: 30, fontWeight: 800, color: ds.color, textTransform: 'uppercase', letterSpacing: 2, lineHeight: 1 }}>
                      {result.decision}
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: ds.color, opacity: 0.7, letterSpacing: 3, marginTop: 4 }}>
                      {ds.label}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 4, color: '#3d5570', textTransform: 'uppercase', marginBottom: 6 }}>CONDITION SCORE</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 42, fontWeight: 600, color: ds.color, lineHeight: 1 }}>
                    {result.hard_rules && !result.hard_rules.passed && (
                  <div
                    style={{
                      fontFamily: 'IBM Plex Mono',
                      fontSize: 9,
                      letterSpacing: 3,
                      color: '#ff3d5a',
                      marginTop: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    ⚠ HARD RULE VETO
                  </div>
                )}
                  </div>
                </div>
              </motion.div>

              {/* 2. THREE METRIC CARDS */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>

                {/* HARD RULES */}
                <div style={{ flex: 1, background: '#090d12', border: '1px solid #162030', borderTop: `2px solid ${result.hard_rules?.passed ? '#29ffa0' : '#ff3d5a'}`, padding: 24 }}>
                  <div style={labelStyle}>Hard Rules</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 26, fontWeight: 600, color: result.hard_rules?.passed ? '#29ffa0' : '#ff3d5a', marginBottom: 16 }}>
                    {result.hard_rules?.failures?.length === 0 ? 'ALL CLEAR' : `${result.hard_rules?.failures?.length} FAILURE${result.hard_rules?.failures?.length !== 1 ? 'S' : ''}`}
                  </div>
                  {result.hard_rules?.results?.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #0d1520' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.passed ? '#1f3045' : '#ff3d5a', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: r.passed ? '#3d5570' : '#b8cfe0', letterSpacing: 1 }}>
                        {r.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ARC GAUGE */}
                <div style={{ flex: 1, background: '#090d12', border: '1px solid #162030', borderTop: '2px solid #162030', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={labelStyle}>Composite Score</div>
                  <ArcGauge
                    score={result.composite_score}
                    decisionColor={ds.color}
                  />
                </div>

                {/* ML */}
                <div style={{ flex: 1, background: '#090d12', border: '1px solid #162030', borderTop: `2px solid ${result.ml?.anomaly_flag ? '#ff6d35' : '#29ffa0'}`, padding: 24 }}>
                  <div style={labelStyle}>ML Detection</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 600, color: result.ml?.anomaly_flag ? '#ff6d35' : '#29ffa0', marginBottom: 12 }}>
                    {result.ml?.anomaly_flag ? 'ANOMALY' : 'NOMINAL'}
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', letterSpacing: 2, marginBottom: 4 }}>
                    CONFIDENCE: {Math.round((result.ml?.confidence || 0) * 100)}%
                  </div>
                  <ConfidenceBar value={result.ml?.confidence || 0} color={result.ml?.anomaly_flag ? '#ff6d35' : '#29ffa0'} />
                  {result.ml?.flagged_features?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      {result.ml.flagged_features.map((f, i) => (
                        <div key={i} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#ff6d35', letterSpacing: 1, padding: '3px 0' }}>
                          ↑ {f}
                        </div>
                      ))}
                    </div>
                  )}
                  {(!result.ml?.flagged_features || result.ml.flagged_features.length === 0) && (
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', marginTop: 14 }}>
                      NO ANOMALOUS PATTERNS
                    </div>
                  )}
                </div>
              </div>

              {/* 3. DOMAIN SCORES */}
              <div style={{ background: '#090d12', border: '1px solid #162030', padding: 24, marginBottom: 4 }}>
                <SectionLabel>Domain Scores</SectionLabel>
                <div style={{ display: 'flex', gap: 32 }}>
                  <DomainBar label="Atmospheric" score={result.scoring?.atmospheric_score || 0} color="#00e5ff" />
                  <DomainBar label="Space Weather" score={result.scoring?.space_weather_score || 0} color="#ffd426" />
                  <DomainBar label="Orbital" score={result.scoring?.orbital_score || 0} color="#29ffa0" />
                </div>
              </div>

              {/* 4. PENALTIES */}
              <PenaltyPanel penalties={result.scoring?.penalties || []} />

              {/* 5. RECOMMENDED ACTIONS */}
              {result.decision !== 'GO' && result.recommended_actions?.length > 0 && (
                <div style={{ background: '#090d12', border: '1px solid #162030', borderLeft: '3px solid #ff3d5a', padding: 24 }}>
                  <div style={{ ...labelStyle, color: '#ff3d5a', marginBottom: 16 }}>To Clear for Launch:</div>
                  {result.recommended_actions.map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #0d1520' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#00e5ff', fontWeight: 600, flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#b8cfe0', lineHeight: 1.6 }}>{action}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 6. RAW REPORT */}
              <RawReport report={report}/>

            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.3); }
        select option { background: #090d12; color: #b8cfe0; }
        select optgroup { background: #05080b; color: #3d5570; }
        input:focus, select:focus { border-color: #00e5ff !important; }
      `}</style>
    </div>
  )
}