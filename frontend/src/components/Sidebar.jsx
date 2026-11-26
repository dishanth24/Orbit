import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home, TrendingUp, BarChart2, Bell, MessageCircle, Shield, Settings,
  Sun, Moon, ChevronLeft, ChevronRight
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
    <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true">
        <ellipse
          cx="18" cy="18" rx="15" ry="6"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          style={{ transformOrigin: '18px 18px', animation: 'spin 8s linear infinite' }}
        />
        <circle cx="18" cy="18" r="5" fill="var(--brand)" />
        <circle
          cx="33" cy="18" r="2.5"
          fill="var(--brand-2)"
          style={{ transformOrigin: '18px 18px', animation: 'spin 3s linear infinite' }}
        />
      </svg>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }) {
  const [theme, toggleTheme] = useTheme()

  return (
    <aside className={`floating-sidebar ${collapsed ? 'collapsed' : 'expanded'}`} aria-label="Main navigation">
      {/* Top Logo / Brand header */}
      <div className="sidebar-brand-row">
        <OrbitLogo />
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="brand-app-name">Orbit</span>
            <Tagline size="normal" />
          </div>
        )}
      </div>

      {/* Navigation list */}
      <nav className="sidebar-nav-list">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-pill-item${isActive ? ' active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} strokeWidth={1.8} className="sidebar-item-icon" />
            {!collapsed && <span className="sidebar-item-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Toggle & Theme button */}
      <div className="sidebar-footer-row">
        <button
          onClick={toggleTheme}
          className="sidebar-pill-item theme-item"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun size={19} strokeWidth={1.8} className="sidebar-item-icon" />
            : <Moon size={19} strokeWidth={1.8} className="sidebar-item-icon" />
          }
          {!collapsed && (
            <span className="sidebar-item-label">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
