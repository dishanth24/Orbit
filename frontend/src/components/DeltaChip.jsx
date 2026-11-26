import React from 'react'

export default function DeltaChip({
  value,
  suffix = '%',
  metric = 'steps',
  tooltip = 'vs the previous 7 days',
  insufficient = false,
}) {
  if (insufficient || value === null || value === undefined || isNaN(value)) {
    return (
      <span
        className="delta-chip delta-insufficient"
        title="Need at least 3 days in both weeks to calculate change"
        style={{
          color: 'var(--muted)',
          background: 'rgba(91, 115, 112, 0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '2px 8px',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.74rem',
          fontWeight: 600,
        }}
      >
        Not enough data
      </span>
    )
  }

  const abs = Math.abs(value)
  const isHeart = metric === 'heart' || metric === 'rhr'

  // Within 1% show "no change"
  if (abs < 1) {
    return (
      <span
        className="delta-chip delta-neutral"
        title={tooltip}
        style={{
          color: 'var(--muted)',
          background: 'rgba(91, 115, 112, 0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.76rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>●</span> No change
      </span>
    )
  }

  // Meaning: up is good for steps, sleep, mood, water; up is bad for resting heart rate
  const isUp = value > 0
  const isGood = isHeart ? !isUp : isUp

  const formatted = Number.isInteger(abs) ? abs.toString() : abs.toFixed(1)
  const displaySuffix = isHeart ? ' bpm' : suffix

  return (
    <span
      className={`delta-chip ${isGood ? 'delta-good' : 'delta-bad'}`}
      title={tooltip}
      style={{
        color: isGood ? 'var(--success)' : 'var(--danger)',
        background: isGood ? 'rgba(46,158,91,0.12)' : 'rgba(224,79,95,0.12)',
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
      {isUp ? '▲' : '▼'} {formatted}{displaySuffix}
    </span>
  )
}
