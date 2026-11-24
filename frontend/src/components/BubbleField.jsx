import React, { useMemo } from 'react'

const BUBBLES = [
  { size: 220, x: 8,  y: 15, color: 'var(--steps)', duration: 18, delay: 0 },
  { size: 160, x: 85, y: 10, color: 'var(--sleep)', duration: 22, delay: -4 },
  { size: 120, x: 60, y: 70, color: 'var(--heart)', duration: 15, delay: -8 },
  { size: 80,  x: 25, y: 60, color: 'var(--mood)',  duration: 12, delay: -2 },
  { size: 100, x: 90, y: 55, color: 'var(--water)', duration: 20, delay: -10 },
  { size: 60,  x: 45, y: 20, color: 'var(--steps)', duration: 11, delay: -5 },
  { size: 140, x: 15, y: 85, color: 'var(--sleep)', duration: 16, delay: -12 },
  { size: 50,  x: 70, y: 40, color: 'var(--heart)', duration: 9,  delay: -3 },
  { size: 180, x: 50, y: 90, color: 'var(--mood)',  duration: 19, delay: -7 },
  { size: 70,  x: 5,  y: 40, color: 'var(--water)', duration: 13, delay: -9 },
  { size: 90,  x: 35, y: 5,  color: 'var(--steps)', duration: 14, delay: -6 },
  { size: 110, x: 78, y: 80, color: 'var(--sleep)', duration: 17, delay: -1 },
  { size: 65,  x: 20, y: 30, color: 'var(--heart)', duration: 10, delay: -11 },
  { size: 95,  x: 55, y: 50, color: 'var(--mood)',  duration: 21, delay: -13 },
]

export function BubbleField() {
  // Determine how many bubbles to show based on window width at mount
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const bubbles = isMobile ? BUBBLES.slice(0, 8) : BUBBLES

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
      {bubbles.map((b, i) => {
        const blur = b.size >= 150 ? `blur(${Math.round(b.size * 0.08)}px)` : undefined
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
              background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, ${b.color} 60%, transparent 100%)`,
              opacity: b.size >= 150 ? 0.12 : 0.15,
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
