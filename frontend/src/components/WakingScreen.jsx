import React, { useState, useEffect } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { BASE_URL } from '../api/client'

export default function WakingScreen({ onAwake }) {
  const [elapsed, setElapsed] = useState(0)
  const [retrying, setRetrying] = useState(false)

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto retry /health every 4 seconds
  useEffect(() => {
    let active = true

    const checkHealth = async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`)
        if (res.ok && active) {
          const data = await res.json().catch(() => ({}))
          if (data.ok) {
            if (onAwake) onAwake()
          }
        }
      } catch (err) {
        // Still waking
      }
    }

    const interval = setInterval(checkHealth, 4000)
    checkHealth() // Initial ping

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [onAwake])

  const handleManualRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch(`${BASE_URL}/health`)
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.ok && onAwake) {
          onAwake()
          return
        }
      }
    } catch (err) {
      // Still sleeping
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="waking-screen-overlay" role="alert" aria-live="polite">
      <div className="card waking-card">
        {/* Animated Orbit Loader */}
        <div className="waking-orbit-loader" aria-hidden="true">
          <div className="waking-ring outer" />
          <div className="waking-ring inner" />
          <div className="waking-center-dot" />
          <div className="waking-orbiting-dot" />
        </div>

        <h2 className="waking-title">Orbit is waking up</h2>
        <p className="waking-subtitle">
          Free hosting puts the server to sleep when idle. This takes up to about a minute.
        </p>

        <div className="waking-timer-badge">
          <span>Elapsed: <strong>{elapsed}s</strong></span>
          <span className="waking-pulse-dot" />
        </div>

        {elapsed >= 90 && (
          <div className="waking-prolonged-section">
            <p className="waking-prolonged-text">Still trying to connect...</p>
            <button
              className="btn-primary waking-retry-btn"
              onClick={handleManualRetry}
              disabled={retrying}
            >
              <RefreshCw size={16} className={retrying ? 'spin' : ''} />
              Retry now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
