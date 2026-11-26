import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useAppContext } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import BottomTabBar from './components/BottomTabBar'
import BubbleField from './components/BubbleField'
import ToastContainer from './components/ToastContainer'
import OfflineBanner from './components/OfflineBanner'
import WakingScreen from './components/WakingScreen'
import ErrorBoundary from './components/ErrorBoundary'

// Pages
import Today from './pages/Today'
import Ask from './pages/Ask'
import Insights from './pages/Insights'
import Privacy from './pages/Privacy'
import Trends from './pages/Trends'
import Nudges from './pages/Nudges'
import Settings from './pages/Settings'

function MainLayout() {
  const { offline } = useAppContext()
  const [isWaking, setIsWaking] = useState(false)

  // Sidebar collapsed state: desktop remembers in localStorage, tablet defaults to collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) return true // Tablet default collapsed
      try {
        const saved = localStorage.getItem('orbit_sidebar_collapsed')
        return saved === 'true'
      } catch (e) {
        return false
      }
    }
    return false
  })

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('orbit_sidebar_collapsed', String(next))
      } catch (e) {}
      return next
    })
  }

  // Listen for backend waking / awake events
  useEffect(() => {
    const handleWaking = () => setIsWaking(true)
    const handleAwake = () => setIsWaking(false)

    window.addEventListener('orbit:waking', handleWaking)
    window.addEventListener('orbit:awake', handleAwake)

    return () => {
      window.removeEventListener('orbit:waking', handleWaking)
      window.removeEventListener('orbit:awake', handleAwake)
    }
  }, [])

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
      <BubbleField />

      {/* Sidebar for Desktop & Tablet */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {offline && <OfflineBanner />}
        {isWaking && <WakingScreen onAwake={() => setIsWaking(false)} />}

        <main className="page-container" id="main-content-scroll">
          <Routes>
            <Route path="/" element={<ErrorBoundary><Today /></ErrorBoundary>} />
            <Route path="/ask" element={<ErrorBoundary><Ask /></ErrorBoundary>} />
            <Route path="/insights" element={<ErrorBoundary><Insights /></ErrorBoundary>} />
            <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
            <Route path="/trends" element={<ErrorBoundary><Trends /></ErrorBoundary>} />
            <Route path="/nudges" element={<ErrorBoundary><Nudges /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p className="medical-disclaimer">
            Demo data and CSV import only · Not medical advice
          </p>
        </footer>
      </div>

      {/* Mobile Floating Bottom Tab Bar */}
      <BottomTabBar />
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <MainLayout />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  )
}
