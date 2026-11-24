import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, TrendingUp, MessageCircle, Shield, MoreHorizontal, BarChart2, Bell, Settings, X } from 'lucide-react'

const MAIN_TABS = [
  { to: '/',        label: 'Today',    Icon: Home },
  { to: '/insights',label: 'Insights', Icon: TrendingUp },
  { to: '/ask',     label: 'Ask',      Icon: MessageCircle },
  { to: '/privacy', label: 'Privacy',  Icon: Shield },
]

const MORE_ITEMS = [
  { to: '/trends',   label: 'Trends',   Icon: BarChart2 },
  { to: '/nudges',   label: 'Nudges',   Icon: Bell },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

function BottomSheet({ onClose }) {
  const navigate = useNavigate()

  const handleNav = (to) => {
    navigate(to)
    onClose()
  }

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="More options">
        <div className="bottom-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>More</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        {MORE_ITEMS.map(({ to, label, Icon }) => (
          <button
            key={to}
            onClick={() => handleNav(to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              padding: '14px 8px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--text)',
              fontFamily: 'var(--font)',
              fontSize: '1rem',
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <Icon size={22} style={{ color: 'var(--brand)' }} />
            {label}
          </button>
        ))}
      </div>
    </>
  )
}

export function BottomTabBar() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()

  const isMoreActive = MORE_ITEMS.some(item => location.pathname === item.to)

  return (
    <>
      {showMore && <BottomSheet onClose={() => setShowMore(false)} />}
      <div className="bottom-tab-bar" role="navigation" aria-label="Bottom navigation">
        <div className="bottom-tab-bar-inner">
          {MAIN_TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}
            >
              <Icon size={22} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}

          <button
            className={`bottom-tab${isMoreActive ? ' active' : ''}`}
            onClick={() => setShowMore(true)}
            aria-label="More navigation options"
          >
            <MoreHorizontal size={22} strokeWidth={1.8} />
            <span>More</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default BottomTabBar
