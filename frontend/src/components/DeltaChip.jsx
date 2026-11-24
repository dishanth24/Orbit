import React from 'react'

export default function DeltaChip({ value, suffix = '%' }) {
  if (value === null || value === undefined || isNaN(value)) return null
  const positive = value >= 0
  return (
    <span
      className="delta-chip"
      style={{
        color: positive ? 'var(--success)' : 'var(--danger)',
        background: positive ? 'rgba(46,158,91,0.12)' : 'rgba(224,79,95,0.12)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.78rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}
