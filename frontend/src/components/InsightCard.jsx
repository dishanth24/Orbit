import React, { useState } from 'react'
import {
  Footprints, Moon, Heart, Smile, Droplets, Flame, Sparkles,
  ChevronDown, Activity
} from 'lucide-react'
import DeltaChip from './DeltaChip'

const LINE_ICONS = {
  steps: Footprints,
  sleep: Moon,
  sleep_h: Moon,
  heart: Heart,
  rhr: Heart,
  mood: Smile,
  water: Droplets,
  water_l: Droplets,
  consistency: Flame,
}

function formatDateFriendly(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  return dateStr
}

export default function InsightCard({ insight }) {
  const [expanded, setExpanded] = useState(false)

  const metricKey = (insight.metric || 'steps').toLowerCase()
  const Icon = LINE_ICONS[metricKey] || Activity
  const category = insight.category || 'good_to_know'

  const sevColor =
    category === 'needs_attention'
      ? 'var(--danger)'
      : category === 'going_well'
      ? 'var(--success)'
      : 'var(--brand)'

  const keyNumber = insight.key_number
  const changeVal = insight.change

  return (
    <div className={`card insight-clean-card category-${category}`}>
      <div className="insight-card-top-row">
        {/* Consistent Line Icon */}
        <div className="insight-icon-bubble" style={{ background: `${sevColor}15`, color: sevColor }}>
          <Icon size={18} strokeWidth={2} />
        </div>

        {/* Title & One Sentence */}
        <div className="insight-content-block">
          <h3 className="insight-title">{insight.title}</h3>
          <p className="insight-body-sentence">{insight.body}</p>
        </div>

        {/* One Key Number & Change Chip (No clutter) */}
        {keyNumber !== undefined && keyNumber !== null && (
          <div className="insight-metric-summary-col">
            <span className="insight-key-number">
              {typeof keyNumber === 'number' ? keyNumber.toLocaleString() : keyNumber}
            </span>
            {changeVal !== null && changeVal !== undefined && (
              <DeltaChip
                value={changeVal}
                metric={insight.metric}
                tooltip="vs the previous 7 days"
              />
            )}
          </div>
        )}
      </div>

      {/* Why am I seeing this? Expander */}
      {insight.rule && (
        <div className="insight-expander-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className="why-seeing-btn"
            aria-expanded={expanded}
          >
            <ChevronDown
              size={14}
              className={`why-chevron ${expanded ? 'rotated' : ''}`}
            />
            <span>Why am I seeing this?</span>
          </button>

          {expanded && (
            <div className="why-seeing-drawer">
              <div className="rule-badge">
                <strong>Rule:</strong> {insight.rule}
              </div>

              {insight.evidence && Object.keys(insight.evidence).length > 0 && (
                <div className="evidence-grid">
                  {Object.entries(insight.evidence).map(([key, val]) => (
                    <div key={key} className="evidence-item">
                      <span className="ev-key">{key.replace(/_/g, ' ')}:</span>
                      <span className="ev-val">
                        {typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)
                          ? formatDateFriendly(val)
                          : typeof val === 'number'
                          ? val.toLocaleString()
                          : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
