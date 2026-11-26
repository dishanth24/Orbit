import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Menu, Sun, Moon, Download, FileText, Table as TableIcon,
  ChevronDown, Check, Loader2, Sparkles
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useApi } from '../hooks/useApi'
import { useToastContext } from '../context/ToastContext'
import { useAppContext } from '../context/AppContext'

const PAGE_TITLES = {
  '/': { title: 'Today', greeting: 'Your personal intelligence at a glance' },
  '/insights': { title: 'Insights', greeting: 'Explainable patterns & deterministic findings' },
  '/trends': { title: 'Trends', greeting: 'Cross-metric circadian & energy dynamics' },
  '/nudges': { title: 'Nudges', greeting: 'Timely, gentle suggestions for your day' },
  '/ask': { title: 'Ask your data', greeting: 'Private on-device answers with evidence' },
  '/privacy': { title: 'Privacy & Ledger', greeting: 'Privacy you can see — all data stays on-device' },
  '/settings': { title: 'Settings', greeting: 'Biomarker goals, themes & CSV import' },
}

export default function Header({ sidebarCollapsed, onToggleSidebar }) {
  const [theme, toggleTheme] = useTheme()
  const location = useLocation()
  const api = useApi()
  const { addToast } = useToastContext()
  const { hasData } = useAppContext()

  const [menuOpen, setMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(null) // 'pdf' | 'xlsx' | null
  const menuRef = useRef(null)

  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Orbit', greeting: 'Know your body.' }

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDownload = async (type) => {
    setDownloading(type)
    setMenuOpen(false)
    const { data, error } = await api.downloadReport(type)
    setDownloading(null)

    if (error) {
      addToast(`Could not generate ${type.toUpperCase()} report: ${error}`, 'error')
    } else {
      addToast(`Report saved to your Downloads (${type.toUpperCase()})`, 'success')
    }
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header className="clean-app-header">
      {/* Left: Sidebar toggle + Page Title & Greeting */}
      <div className="header-left">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={20} />
        </button>

        <div className="header-titles-block">
          <h1 className="header-page-title">{pageInfo.title}</h1>
          <span className="header-page-greeting">{pageInfo.greeting}</span>
        </div>
      </div>

      {/* Right: Date Range Chip, Download Report Menu, Theme Toggle, Avatar */}
      <div className="header-right">
        {/* Date chip */}
        <span className="header-date-chip" title="Current session date">
          {dateStr}
        </span>

        {/* Download Report Dropdown Menu */}
        <div className="download-report-wrap" ref={menuRef}>
          <button
            className="btn-download-report"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={downloading !== null}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            title="Download audit-grade health report"
          >
            {downloading ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span className="btn-download-text">Download report</span>
                <ChevronDown size={14} className={`chevron-icon ${menuOpen ? 'open' : ''}`} />
              </>
            )}
          </button>

          {menuOpen && (
            <div className="download-dropdown-menu card" role="menu">
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleDownload('pdf')}
              >
                <FileText size={16} color="var(--brand)" />
                <div className="item-text">
                  <strong>PDF Report (A4)</strong>
                  <span>Audit-grade document with vector charts &amp; proof</span>
                </div>
              </button>

              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleDownload('xlsx')}
              >
                <TableIcon size={16} color="var(--sleep)" />
                <div className="item-text">
                  <strong>Excel Workbook (.xlsx)</strong>
                  <span>Multi-sheet with live AVERAGE &amp; change % formulas</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="header-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User initials chip */}
        <div className="header-avatar-chip" title="You (Offline Local User)">
          ME
        </div>
      </div>
    </header>
  )
}
