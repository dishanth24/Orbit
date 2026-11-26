import React, { useState, useEffect } from 'react'
import { Bell, BellRing, Volume2, CheckCircle2, ChevronDown, Check, Clock, Sparkles } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import { useVoice } from '../hooks/useVoice'
import CountUp from '../components/CountUp'
import SkeletonCard from '../components/SkeletonCard'

const SNOOZE_PRESETS = [
  { label: '3 hours', value: '3h' },
  { label: 'Tonight', value: 'tonight' },
  { label: 'Tomorrow', value: 'tomorrow' },
]

export default function Nudges() {
  const api = useApi()
  const { addToast } = useToastContext()
  const { speak } = useVoice()

  const [loading, setLoading] = useState(true)
  const [nudges, setNudges] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [showCompleted, setShowCompleted] = useState(false)
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  const fetchNudges = async () => {
    setLoading(true)
    const { data } = await api.getNudges()
    setLoading(false)
    if (data) {
      setNudges(data)
      const done = data.filter((n) => n.status === 'done').length
      setCompletedCount(done)
    }
  }

  useEffect(() => {
    fetchNudges()
  }, [])

  const handleDone = async (id) => {
    const { error } = await api.markNudgeDone(id)
    if (error) {
      addToast(error, 'error')
      return
    }
    setNudges((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'done' } : n))
    )
    setCompletedCount((c) => c + 1)
    addToast('Nudge marked done! Keep orbiting strong.', 'success')
    speak('Nice work! Nudge marked done.')
  }

  const handleSnooze = async (id, value) => {
    const { error } = await api.snoozeNudge(id, value)
    if (error) {
      addToast(error, 'error')
      return
    }
    setNudges((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'snoozed', snooze_until: value } : n))
    )
    addToast(`Snoozed for ${value}`, 'info')
  }

  const handleReadAloud = (text) => {
    speak(text)
    addToast('Reading nudge aloud...', 'info')
  }

  const handleEnableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      addToast('Notifications not supported in this browser', 'error')
      return
    }
    try {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
      if (perm === 'granted') {
        addToast('Notifications enabled!', 'success')
        new Notification('Orbit Health', {
          body: 'Orbit notifications are now active on your device.',
          icon: '/favicon.ico',
        })
      } else {
        addToast('Notifications were not granted', 'info')
      }
    } catch (err) {
      addToast('Could not request notification permission', 'error')
    }
  }

  const activeNudges = nudges.filter((n) => n.status === 'pending' || n.status === 'snoozed')
  const completedNudges = nudges.filter((n) => n.status === 'done')

  return (
    <div className="nudges-page">
      {/* Header */}
      <div className="nudges-header-row">
        <div>
          <h1 className="page-title">Actionable Nudges</h1>
          <p className="page-subtitle">
            Gentle, timely micro-interventions computed to steer your trajectory back to your optimal goals.
          </p>
        </div>

        {/* Notification Permission Button */}
        <button
          className={`btn-secondary ${notifStatus === 'granted' ? 'btn-granted' : ''}`}
          onClick={handleEnableNotifications}
          disabled={notifStatus === 'granted'}
        >
          {notifStatus === 'granted' ? (
            <>
              <BellRing size={16} />
              <span>Notifications enabled</span>
            </>
          ) : (
            <>
              <Bell size={16} />
              <span>Enable notifications</span>
            </>
          )}
        </button>
      </div>

      {/* Active Nudges List */}
      <div className="nudges-list-section">
        {loading ? (
          <div className="nudges-grid">
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
          </div>
        ) : activeNudges.length === 0 ? (
          <div className="card empty-nudges-card">
            <CheckCircle2 size={44} className="check-all-big" />
            <h3>All nudges cleared!</h3>
            <p className="muted-text">You are right on track. Orbit will create new nudges as new data arrives.</p>
          </div>
        ) : (
          <div className="nudges-grid">
            {activeNudges.map((nudge) => {
              const isSnoozed = nudge.status === 'snoozed'

              return (
                <div key={nudge.id} className={`card nudge-page-card ${isSnoozed ? 'snoozed' : ''}`}>
                  <div className="nudge-top-meta">
                    <span className="nudge-kind-badge">
                      <Sparkles size={12} /> {nudge.kind?.replace(/_/g, ' ')}
                    </span>
                    <button
                      className="icon-action-btn"
                      onClick={() => handleReadAloud(nudge.text)}
                      title="Read aloud"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  <p className="nudge-page-text">{nudge.text}</p>

                  {isSnoozed && (
                    <div className="snoozed-state-strip">
                      <Clock size={14} /> Snoozed until: {nudge.snooze_until}
                    </div>
                  )}

                  <div className="nudge-actions-bar">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => handleDone(nudge.id)}
                    >
                      <Check size={14} />
                      Done
                    </button>

                    <div className="snooze-buttons-row">
                      <span className="snooze-label">Snooze:</span>
                      {SNOOZE_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          className="btn-secondary btn-xs"
                          onClick={() => handleSnooze(nudge.id, p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed Nudges Collapsible */}
      <div className="completed-nudges-section card">
        <button
          className="completed-toggle-btn"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <div className="completed-title-wrap">
            <CheckCircle2 size={18} className="completed-check-icon" />
            <span>Completed nudges</span>
            <span className="completed-count-badge">
              <CountUp value={completedCount} />
            </span>
          </div>
          <ChevronDown
            size={18}
            style={{
              transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          />
        </button>

        {showCompleted && (
          <div className="completed-list-wrap">
            {completedNudges.length === 0 ? (
              <p className="muted-text" style={{ padding: '12px 16px' }}>No completed nudges yet.</p>
            ) : (
              completedNudges.map((n) => (
                <div key={n.id} className="completed-nudge-item">
                  <Check size={14} className="done-icon" />
                  <span className="completed-item-text">{n.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
