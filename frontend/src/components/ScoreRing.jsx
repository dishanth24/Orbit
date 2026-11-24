import React, { useEffect, useState } from 'react'
import CountUp from './CountUp'

export default function ScoreRing({ score = 0, size = 200 }) {
  const [animated, setAnimated] = useState(false)

  const strokeWidth = size * 0.055
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(id)
  }, [score])

  return (
    <div
      className="score-ring"
      style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0E7C6B" />
            <stop offset="50%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#5B6CFF" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(14,124,107,0.12)"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? offset : circumference}
          filter="url(#ring-glow)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>

      {/* Center score */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
          <CountUp value={score} duration={1200} />
        </div>
        <div style={{ fontSize: size * 0.08, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>
          Orbit Score
        </div>
      </div>
    </div>
  )
}
