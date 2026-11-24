import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home, TrendingUp, BarChart2, Bell, MessageCircle, Shield, Settings, Sun, Moon
} from 'lucide-react'
import { Tagline } from './Tagline'
import { useTheme } from '../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/',          label: 'Today',    Icon: Home },
  { to: '/insights',  label: 'Insights', Icon: TrendingUp },
  { to: '/trends',    label: 'Trends',   Icon: BarChart2 },
  { to: '/nudges',    label: 'Nudges',   Icon: Bell },
  { to: '/ask',       label: 'Ask',      Icon: MessageCircle },
  { to: '/privacy',   label: 'Privacy',  Icon: Shield },
  { to: '/settings',  label: 'Settings', Icon: Settings },
]

function OrbitLogo() {
  return (
    <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        {/* Orbit ring */}
        <ellipse
          cx="18" cy="18" rx="15" ry="6"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          style={{ transformOrigin: '18px 18px', animation: 'spin 8s linear infinite' }}
        />
        {/* Core */}
        <circle cx="18" cy="18" r="5" fill="var(--brand)" />
        {/* Orbiting dot */}
        <circle
          cx="33" cy="18" r="2.5"
          fill="var(--brand-2)"
          style={{
            transformOrigin: '18px 18px',
            animation: 'spin 3s linear infinite',
          }}
        />
      </svg>
    </div>
  )
}

export function Sidebar() {
  const [theme, toggleTheme] = useTheme()

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <OrbitLogo />
        <div className="sidebar-nav-label" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>Orbit</div>
          <Tagline size="normal" />
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
            title={label}
          >
            <Icon size={20} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span className="sidebar-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Theme toggle */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={toggleTheme}
          className="sidebar-nav-item"
          style={{
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun size={20} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            : <Moon size={20} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          }
          <span className="sidebar-nav-label">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </span>
        </button>
      </div>
    </nav>
  )
}

export default Sidebar
