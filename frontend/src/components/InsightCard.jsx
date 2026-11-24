import React, { useState } from 'react'
import EvidencePill from './EvidencePill'
import { ChevronDown } from 'lucide-react'

const SEVERITY_COLORS = {
  good: 'var(--success)',
  info: 'var(--brand)',
  warn: 'var(--warn)',
  bad: 'var(--danger)',
}

const METRIC_ICONS = {
  steps: '👟',
  sleep: '😴',
  heart: '❤️',
  mood: '😊',
  water: '💧',
  consistency: '🔥',
}

export default function InsightCard({ insight }) {
  const [expanded, setExpanded] = useState(false)

  const severity = insight.severity || 'info'
  const sevColor = SEVERITY_COLORS[severity] || 'var(--brand)'
  const icon = METRIC_ICONS[insight.metric] || '💡'

  return (
    <div
      className="card insight-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon with severity dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{ fontSize: '1.4rem' }}>{icon}</span>
          <span
            style={{
              position: 'absolute',
              bottom: -1,
              right: -3,
              width: 9,
              height: 9,
              background: sevColor,
              borderRadius: '50%',
              border: '1.5px solid var(--card)',
            }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {insight.title}
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            {insight.body}
          </p>
        </div>
      </div>

      {/* Evidence pills */}
      {insight.evidence && Object.keys(insight.evidence).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(insight.evidence).map(([key, val]) => (
            <EvidencePill key={key} metric={insight.metric} value={val} label={key.replace(/_/g, ' ')} />
          ))}
        </div>
      )}

      {/* Why expander */}
      {insight.rule && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font)',
              padding: '4px 0',
              fontWeight: 600,
            }}
          >
            <ChevronDown
              size={14}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms ease',
              }}
            />
            Why am I seeing this?
          </button>

          <div
            style={{
              maxHeight: expanded ? '200px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 350ms ease',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--brand-tint)',
                borderRadius: 10,
                marginTop: 6,
              }}
            >
              <p style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>
                {insight.rule}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
