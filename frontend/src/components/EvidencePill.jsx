import React from 'react'

const METRIC_COLORS = {
  steps: 'var(--steps)',
  sleep: 'var(--sleep)',
  heart: 'var(--heart)',
  mood: 'var(--mood)',
  water: 'var(--water)',
}

const METRIC_BG = {
  steps: 'rgba(15,163,143,0.15)',
  sleep: 'rgba(108,123,255,0.15)',
  heart: 'rgba(242,97,107,0.15)',
  mood: 'rgba(245,165,36,0.15)',
  water: 'rgba(56,169,242,0.15)',
}

export default function EvidencePill({ metric, value, label }) {
  const color = METRIC_COLORS[metric] || 'var(--brand)'
  const bg = METRIC_BG[metric] || 'var(--brand-tint)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
        background: bg,
        color,
        fontSize: '0.78rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value !== undefined && <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>}
      {label && <span style={{ fontWeight: 500 }}>{label}</span>}
    </span>
  )
}
