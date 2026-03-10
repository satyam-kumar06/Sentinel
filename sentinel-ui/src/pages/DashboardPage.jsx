import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const DECISION_COLOR = {
  'GO':      '#29ffa0',
  'CAUTION': '#ffd426',
  'HOLD':    '#ff6d35',
  'NO-GO':   '#ff3d5a',
}

const DECISION_BG = {
  'GO':      'rgba(41,255,160,0.08)',
  'CAUTION': 'rgba(255,212,38,0.08)',
  'HOLD':    'rgba(255,109,53,0.08)',
  'NO-GO':   'rgba(255,61,90,0.08)',
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().replace('T', ' · ').slice(0, 22) + ' UTC')
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#3d5570', letterSpacing: 2 }}>{time}</span>
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 6, color: '#3d5570', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: '#162030' }} />
    </div>
  )
}

function StatCard({ label, value, unit, color = '#b8cfe0', sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: '#090d12', border: '1px solid #162030', borderTop: `2px solid ${color}`, padding: 24, flex: 1 }}
    >
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 4, color: '#3d5570', textTransform: 'uppercase', marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 38, fontWeight: 600, color, lineHeight: 1 }}>{value ?? '—'}</span>
        {unit && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#3d5570' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', marginTop: 8, letterSpacing: 1 }}>{sub}</div>}
    </motion.div>
  )
}

function DecisionBadge({ decision }) {
  if (!decision) return null
  const color = DECISION_COLOR[decision] || '#3d5570'
  return (
    <span style={{
      fontFamily: 'IBM Plex Mono', fontSize: 10, padding: '4px 12px',
      background: `${color}15`, border: `1px solid ${color}40`,
      color, letterSpacing: 3, textTransform: 'uppercase'
    }}>{decision}</span>
  )
}

function MiniScoreBar({ score }) {
  const color = score < 50 ? '#ff3d5a' : score < 80 ? '#ffd426' : '#29ffa0'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, background: '#162030', height: 3 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: color }}
        />
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color, width: 32, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#090d12', border: '1px solid #1f3045', padding: '10px 16px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', marginBottom: 4 }}>{d.assessed_at?.slice(0, 10)}</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: DECISION_COLOR[d.decision] || '#b8cfe0' }}>
        {d.decision} — {d.composite_score}/100
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', marginTop: 2 }}>{d.vehicle}</div>
    </div>
  )
}

function HistoryTable({ data, filter, setFilter }) {
  const [expanded, setExpanded] = useState(null)
  const filters = ['ALL', 'GO', 'CAUTION', 'HOLD', 'NO-GO']

  const filtered = filter === 'ALL' ? data : data.filter(d => d.decision === filter)

  return (
    <div>
      {/* Filter Toggles */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {filters.map(f => {
          const active = filter === f
          const color = f === 'ALL' ? '#b8cfe0' : DECISION_COLOR[f]
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 3,
              textTransform: 'uppercase', padding: '6px 14px', cursor: 'pointer',
              background: active ? `${color}15` : 'transparent',
              border: `1px solid ${active ? color : '#162030'}`,
              color: active ? color : '#3d5570',
              transition: 'all 0.15s'
            }}>{f}</button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#090d12', border: '1px solid #162030' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 120px 80px 100px',
          padding: '10px 20px', borderBottom: '1px solid #162030',
          fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: 3,
          color: '#3d5570', textTransform: 'uppercase'
        }}>
          <span>Timestamp</span>
          <span>Site</span>
          <span>Vehicle</span>
          <span>Score</span>
          <span>Decision</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#1f3045', letterSpacing: 4 }}>
            NO ASSESSMENTS ON RECORD
          </div>
        )}

        {filtered.map((row, i) => (
          <div key={row.id || i}>
            <div
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 120px 80px 100px',
                padding: '14px 20px', borderBottom: '1px solid #0d1520',
                cursor: 'pointer', transition: 'background 0.15s',
                background: expanded === i ? '#0d1520' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0d1520'}
              onMouseLeave={e => e.currentTarget.style.background = expanded === i ? '#0d1520' : 'transparent'}
            >
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#3d5570' }}>
                {row.assessed_at?.slice(0, 16).replace('T', ' ')}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#b8cfe0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.site_lat?.toFixed(2)}°, {row.site_lng?.toFixed(2)}°
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#b8cfe0' }}>{row.vehicle}</span>
              <span>
                <MiniScoreBar score={row.composite_score || 0} />
              </span>
              <span><DecisionBadge decision={row.decision} /></span>
            </div>

            <AnimatePresence>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ overflow: 'hidden', borderBottom: '1px solid #162030' }}
                >
                  <pre style={{
                    fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#4a6070',
                    background: '#090d12', padding: '20px 24px',
                    overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0
                  }}>
                    {row.full_json
                      ? JSON.stringify(JSON.parse(row.full_json), null, 2)
                      : 'No detailed report available.'}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApiStatusRow({ status }) {
  const apis = [
    { key: 'nws',       label: 'NOAA NWS',     desc: 'Atmospheric' },
    { key: 'swpc',      label: 'NOAA SWPC',    desc: 'Space Weather' },
    { key: 'donki',     label: 'NASA DONKI',   desc: 'Solar Events' },
    { key: 'celestrak', label: 'CelesTrak',    desc: 'Orbital TLEs' },
  ]
  const color = (s) => s === 'ok' ? '#29ffa0' : s === 'degraded' ? '#ffd426' : '#ff3d5a'
  const label = (s) => s === 'ok' ? 'ONLINE' : s === 'degraded' ? 'DEGRADED' : 'OFFLINE'

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {apis.map(api => {
        const s = status?.[api.key]
        const c = color(s)
        return (
          <div key={api.key} style={{
            flex: 1, background: '#090d12', border: '1px solid #162030',
            borderTop: `2px solid ${c}`, padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <motion.div
                animate={s === 'ok' ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: c }}
              />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#b8cfe0', fontWeight: 600 }}>{api.label}</span>
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#3d5570', letterSpacing: 2, marginBottom: 4 }}>{api.desc}</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: c, letterSpacing: 3 }}>{label(s)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [historyFilter, setHistoryFilter] = useState('ALL')

  const { data: history = [] } = useQuery({
    queryKey: ['history'],
    queryFn: () => axios.get('/history').then(r => r.data),
    refetchInterval: 30000,
    retry: false,
  })

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => axios.get('/status').then(r => r.data),
    refetchInterval: 30000,
    retry: false,
  })

  const last = history[0]
  const avg = history.length
    ? Math.round(history.reduce((s, h) => s + (h.composite_score || 0), 0) / history.length)
    : null

  const decisionCounts = history.reduce((acc, h) => {
    acc[h.decision] = (acc[h.decision] || 0) + 1
    return acc
  }, {})

  const chartData = history.slice(0, 20).reverse().map((h, i) => ({
    ...h,
    index: i + 1,
  }))

  return (
    <div style={{ background: '#05080b', minHeight: '100vh', padding: 32 }}>

      {/* TITLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
          Mission Control
        </h1>
        <LiveClock />
      </div>
      <div style={{ height: 1, background: '#162030', marginBottom: 32 }} />

      {/* STAT CARDS */}
      <SectionLabel>System Overview</SectionLabel>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <StatCard
          label="Last Decision"
          value={last?.decision ?? '—'}
          color={last ? DECISION_COLOR[last.decision] : '#1f3045'}
          sub={last ? `${last.vehicle} · ${last.assessed_at?.slice(0, 10)}` : 'No assessments yet'}
        />
        <StatCard
          label="Last Score"
          value={last?.composite_score ?? '—'}
          unit="/100"
          color={last ? (last.composite_score >= 80 ? '#29ffa0' : last.composite_score >= 50 ? '#ffd426' : '#ff3d5a') : '#1f3045'}
          sub={last ? `Site: ${last.site_lat?.toFixed(2)}°, ${last.site_lng?.toFixed(2)}°` : ''}
        />
        <StatCard
          label="Total Assessments"
          value={history.length}
          color="#00e5ff"
          sub={`GO: ${decisionCounts['GO'] || 0}  ·  NO-GO: ${decisionCounts['NO-GO'] || 0}`}
        />
        <StatCard
          label="Avg Risk Score"
          value={avg ?? '—'}
          unit="/100"
          color={avg >= 80 ? '#29ffa0' : avg >= 50 ? '#ffd426' : avg ? '#ff3d5a' : '#1f3045'}
          sub="Rolling average across all assessments"
        />
      </div>

      {/* QUICK LAUNCH */}
      <div style={{ marginBottom: 32 }}>
        <motion.button
          onClick={() => navigate('/assess')}
          whileHover={{ backgroundColor: '#00e5ff', color: '#05080b' }}
          whileTap={{ scale: 0.99 }}
          style={{
            background: 'transparent', border: '1px solid #00e5ff',
            color: '#00e5ff', fontFamily: 'IBM Plex Mono', fontSize: 11,
            letterSpacing: 5, textTransform: 'uppercase', padding: '14px 32px',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          + NEW ASSESSMENT
        </motion.button>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#3d5570', marginLeft: 20, letterSpacing: 2 }}>
          {last ? `Last run: ${last.assessed_at?.slice(0, 16).replace('T', ' ')} UTC · ${last.vehicle}` : 'No previous assessments'}
        </span>
      </div>

      {/* SCORE CHART */}
      {chartData.length > 0 && (
        <>
          <SectionLabel>Score History — Last {chartData.length} Assessments</SectionLabel>
          <div style={{ background: '#090d12', border: '1px solid #162030', padding: '24px 20px', marginBottom: 4 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={20}>
                <XAxis dataKey="index" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="composite_score" radius={0}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={DECISION_COLOR[entry.decision] || '#1f3045'} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, justifyContent: 'flex-end' }}>
              {Object.entries(DECISION_COLOR).map(([d, c]) => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, background: c }} />
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#3d5570', letterSpacing: 2 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* API STATUS */}
      <SectionLabel>API Data Sources</SectionLabel>
      <div style={{ marginBottom: 32 }}>
        <ApiStatusRow status={status} />
      </div>

      {/* HISTORY TABLE */}
      <SectionLabel>Assessment Log</SectionLabel>
      <HistoryTable data={history} filter={historyFilter} setFilter={setHistoryFilter} />

    </div>
  )
}