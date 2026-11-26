import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, TrendingUp, MessageCircle, Shield, MoreHorizontal,
  BarChart2, Bell, Settings, X, Download, FileText, Table as TableIcon, Loader2
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useToastContext } from '../context/ToastContext'

const MAIN_TABS = [
  { to: '/',        label: 'Today',    Icon: Home },
  { to: '/insights',label: 'Insights', Icon: TrendingUp },
  { to: '/trends',  label: 'Trends',   Icon: BarChart2 },
  { to: '/ask',     label: 'Ask',      Icon: MessageCircle },
]

const MORE_ITEMS = [
  { to: '/nudges',   label: 'Nudges',   Icon: Bell },
  { to: '/privacy',  label: 'Privacy',  Icon: Shield },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

function BottomSheet({ onClose }) {
  const navigate = useNavigate()
  const api = useApi()
  const { addToast } = useToastContext()
  const [downloading, setDownloading] = useState(null)

  const handleNav = (to) => {
    navigate(to)
    onClose()
  }

  const handleDownload = async (type) => {
    setDownloading(type)
    const { data, error } = await api.downloadReport(type)
    setDownloading(null)
    onClose()

    if (error) {
      addToast(`Could not generate ${type.toUpperCase()} report: ${error}`, 'error')
    } else {
      addToast(`Report saved to your Downloads (${type.toUpperCase()})`, 'success')
    }
  }

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="More navigation options">
        <div className="bottom-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)' }}>More</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 10,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        {/* Navigation destinations */}
        {MORE_ITEMS.map(({ to, label, Icon }) => (
          <button
            key={to}
            onClick={() => handleNav(to)}
            className="bottom-sheet-item-btn"
          >
            <Icon size={22} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            <span>{label}</span>
          </button>
        ))}

        {/* Download report actions in More sheet */}
        <div className="bottom-sheet-section-label">Download Reports</div>
        <button
          onClick={() => handleDownload('pdf')}
          disabled={downloading !== null}
          className="bottom-sheet-item-btn"
        >
          {downloading === 'pdf' ? (
            <Loader2 size={22} className="spin" style={{ color: 'var(--brand)' }} />
          ) : (
            <FileText size={22} style={{ color: 'var(--brand)', flexShrink: 0 }} />
          )}
          <span>Download PDF Report</span>
        </button>

        <button
          onClick={() => handleDownload('xlsx')}
          disabled={downloading !== null}
          className="bottom-sheet-item-btn"
        >
          {downloading === 'xlsx' ? (
            <Loader2 size={22} className="spin" style={{ color: 'var(--sleep)' }} />
          ) : (
            <TableIcon size={22} style={{ color: 'var(--sleep)', flexShrink: 0 }} />
          )}
          <span>Download Excel Workbook</span>
        </button>
      </div>
    </>
  )
}

export function BottomTabBar() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()

  const isMoreActive = MORE_ITEMS.some((item) => location.pathname === item.to)

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
              <Icon size={20} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}

          <button
            className={`bottom-tab${isMoreActive ? ' active' : ''}`}
            onClick={() => setShowMore(true)}
            aria-label="More navigation options"
          >
            <MoreHorizontal size={20} strokeWidth={1.9} />
            <span>More</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default BottomTabBar
