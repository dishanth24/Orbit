import React from 'react'

const METRIC_COLORS = {
  steps: 'var(--steps)',
  sleep: 'var(--sleep)',
  heart: 'var(--heart)',
  mood: 'var(--mood)',
  water: 'var(--water)',
}

const METRIC_BG = {
  steps: 'rgba(15,163,143,0.12)',
  sleep: 'rgba(108,123,255,0.12)',
  heart: 'rgba(242,97,107,0.12)',
  mood: 'rgba(245,165,36,0.12)',
  water: 'rgba(56,169,242,0.12)',
}

export default function MetricChip({ metric, label, active = false, onClick }) {
  const color = METRIC_COLORS[metric] || 'var(--brand)'
  const bg = METRIC_BG[metric] || 'var(--brand-tint)'

  return (
    <button
      className={`metric-chip ${active ? 'metric-chip--active' : ''}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '6px 14px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.82rem',
        fontWeight: 600,
        fontFamily: 'var(--font)',
        cursor: onClick ? 'pointer' : 'default',
        border: active ? `2px solid ${color}` : '2px solid transparent',
        background: active ? bg : 'var(--card)',
        color: active ? color : 'var(--muted)',
        transition: 'all var(--transition)',
        minHeight: '36px',
      }}
      aria-pressed={active}
    >
      {label || metric.charAt(0).toUpperCase() + metric.slice(1)}
    </button>
  )
}
