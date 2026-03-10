import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Layout({ children }) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toISOString().replace('T', ' · ').slice(0, 22) + ' UTC')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => axios.get('/status').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  })

  const apis = ['NWS', 'SWPC', 'DONKI', 'TLE']
  const dotColor = (key) => {
    const s = status?.[key.toLowerCase()]
    if (s === 'ok') return '#29ffa0'
    if (s === 'degraded') return '#ffd426'
    return '#ff3d5a'
  }

  const navStyle = ({ isActive }) => ({
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '11px',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    textDecoration: 'none',
    padding: '0 16px',
    color: isActive ? '#ffffff' : '#3d5570',
    borderLeft: isActive ? '2px solid #00e5ff' : '2px solid transparent',
  })

  return (
    <div style={{ background: '#05080b', minHeight: '100vh', color: '#b8cfe0' }}>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: '#05080b', borderBottom: '1px solid #162030',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100
      }}>
        {/* LEFT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#29ffa0', animation: 'pulse 2s infinite'
          }}/>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px',
            letterSpacing: '6px', color: '#00e5ff', textTransform: 'uppercase'
          }}>SENTINEL</span>
        </div>

        {/* CENTER */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NavLink to="/" style={navStyle}>Dashboard</NavLink>
          <NavLink to="/monitor" style={navStyle}>Monitor</NavLink>
          <NavLink to="/assess" style={navStyle}>Assess</NavLink>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {apis.map(api => (
              <div key={api} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor(api) }}/>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#3d5570', letterSpacing: '1px' }}>{api}</span>
              </div>
            ))}
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#3d5570' }}>{clock}</span>
        </div>
      </nav>

      <main style={{ paddingTop: '56px' }}>{children}</main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #090d12; }
        ::-webkit-scrollbar-thumb { background: #1f3045; }
        ::-webkit-scrollbar-thumb:hover { background: #00e5ff; }
      `}</style>
    </div>
  )
}