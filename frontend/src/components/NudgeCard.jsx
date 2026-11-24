import React, { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToastContext } from '../context/ToastContext'
import { useVoice } from '../hooks/useVoice'
import { CheckCircle, BellOff } from 'lucide-react'

const SNOOZE_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'tomorrow', label: 'Tomorrow' },
]

const KIND_COLORS = {
  steps_short: 'var(--steps)',
  sleep_winddown: 'var(--sleep)',
  hr_rest: 'var(--heart)',
  water: 'var(--water)',
}

export default function NudgeCard({ nudge, onDone, onSnooze }) {
  const [leaving, setLeaving] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [snoozedUntil, setSnoozedUntil] = useState(null)
  const api = useApi()
  const { addToast } = useToastContext()
  const { speak } = useVoice()

  const color = KIND_COLORS[nudge.kind] || 'var(--brand)'

  const handleDone = async () => {
    setLeaving(true)
    setTimeout(async () => {
      const { error } = await api.markNudgeDone(nudge.id)
      if (error) {
        addToast(error, 'error')
        setLeaving(false)
        return
      }
      addToast('Nice work! ✅', 'success')
      speak('Done! Great job keeping your orbit.')
      onDone?.(nudge.id)
    }, 350)
  }

  const handleSnooze = async (option) => {
    setSnoozeOpen(false)
    const { error } = await api.snoozeNudge(nudge.id, option.value)
    if (error) { addToast(error, 'error'); return }
    setSnoozedUntil(option.label)
    onSnooze?.(nudge.id, option.value)
    addToast(`Snoozed until ${option.label}`, 'info')
  }

  const readAloud = () => {
    speak(nudge.text)
  }

  return (
    <div
      className="card nudge-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translateY(-12px)' : 'translateY(0)',
        transition: 'opacity 350ms ease, transform 350ms ease',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span
            className="chip-metric"
            style={{
              background: `${color}22`,
              color,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              fontWeight: 700,
              marginBottom: 6,
              display: 'inline-block',
            }}
          >
            {nudge.kind?.replace(/_/g, ' ')}
          </span>
          <p style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5 }}>
            {nudge.text}
          </p>
          {snoozedUntil && (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
              Snoozed until {snoozedUntil}
            </p>
          )}
        </div>
      </div>

      {!snoozedUntil && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', minHeight: 44 }} onClick={handleDone}>
            <CheckCircle size={15} /> Done
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.85rem', minHeight: 44 }}
              onClick={() => setSnoozeOpen(!snoozeOpen)}
            >
              <BellOff size={15} /> Snooze
            </button>
            {snoozeOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow)',
                  zIndex: 50,
                  overflow: 'hidden',
                  minWidth: 150,
                }}
              >
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSnooze(opt)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      color: 'var(--text)',
                      fontFamily: 'var(--font)',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={e => e.target.style.background = 'var(--brand-tint)'}
                    onMouseLeave={e => e.target.style.background = 'none'}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={readAloud}
            style={{
              padding: '8px 14px',
              fontSize: '0.82rem',
              color: 'var(--muted)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              minHeight: 44,
              transition: 'color var(--transition)',
            }}
          >
            🔊
          </button>
        </div>
      )}
    </div>
  )
}
