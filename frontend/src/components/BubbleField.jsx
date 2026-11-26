import React from 'react'

const BUBBLES_5 = [
  { size: 200, x: 10, y: 15, color: 'var(--steps)', duration: 22, delay: 0 },
  { size: 160, x: 88, y: 18, color: 'var(--sleep)', duration: 26, delay: -4 },
  { size: 120, x: 75, y: 75, color: 'var(--heart)', duration: 20, delay: -8 },
  { size: 110, x: 20, y: 70, color: 'var(--mood)',  duration: 18, delay: -2 },
  { size: 140, x: 50, y: 88, color: 'var(--water)', duration: 24, delay: -6 },
]

export function BubbleField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {BUBBLES_5.map((b, i) => {
        const blur = `blur(${Math.round(b.size * 0.08)}px)`
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.4) 0%, ${b.color} 65%, transparent 100%)`,
              opacity: 0.08,
              filter: blur,
              animation: `float ${b.duration}s ease-in-out infinite`,
              animationDelay: `${b.delay}s`,
            }}
          />
        )
      })}
    </div>
  )
}

export default BubbleField
