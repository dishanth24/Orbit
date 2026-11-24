import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AppProvider, useAppContext } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { Sidebar } from './components/Sidebar'
import { BottomTabBar } from './components/BottomTabBar'
import BubbleField from './components/BubbleField'
import ToastContainer from './components/ToastContainer'
import OfflineBanner from './components/OfflineBanner'
import ErrorBoundary from './components/ErrorBoundary'
import { useTheme } from './hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

// Pages
import Today from './pages/Today'
import Ask from './pages/Ask'
import Insights from './pages/Insights'
import Privacy from './pages/Privacy'
import Trends from './pages/Trends'
import Nudges from './pages/Nudges'
import Settings from './pages/Settings'

function TopBar() {
  const [theme, toggleTheme] = useTheme()
  const now = new Date()
  const hours = now.getHours()
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-greeting">{greeting}</span>
        <span className="topbar-date-chip">{dateStr}</span>
      </div>
      <div className="topbar-right">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="avatar-chip" title="You">
          ME
        </div>
      </div>
    </header>
  )
}

function MainLayout() {
  const { offline } = useAppContext()

  return (
    <div className="app-shell">
      <BubbleField />
      <Sidebar />
      <main className="main-content">
        <TopBar />
        {offline && <OfflineBanner />}
        <div className="page-container">
          <Routes>
            <Route path="/" element={<ErrorBoundary><Today /></ErrorBoundary>} />
            <Route path="/ask" element={<ErrorBoundary><Ask /></ErrorBoundary>} />
            <Route path="/insights" element={<ErrorBoundary><Insights /></ErrorBoundary>} />
            <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
            <Route path="/trends" element={<ErrorBoundary><Trends /></ErrorBoundary>} />
            <Route path="/nudges" element={<ErrorBoundary><Nudges /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          </Routes>
        </div>
        <footer className="app-footer">
          <p className="medical-disclaimer">Not medical advice. CSV import &amp; demo data only, no live wearable sync.</p>
        </footer>
      </main>
      <BottomTabBar />
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AppProvider>
  )
}
