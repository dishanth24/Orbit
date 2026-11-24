import React, { useEffect, useRef, useState } from 'react'

export default function ProgressBar({ value = 0, color = 'var(--brand)' }) {
  const [width, setWidth] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    // Slight delay to trigger CSS animation after mount
    const id = setTimeout(() => setWidth(Math.min(Math.max(value, 0), 100)), 50)
    return () => clearTimeout(id)
  }, [value])

  return (
    <div
      className="progress-bar-track"
      style={{
        width: '100%',
        height: '5px',
        background: 'var(--border)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
      }}
    >
      <div
        className="progress-bar-fill"
        style={{
          height: '100%',
          width: `${width}%`,
          background: color,
          borderRadius: 'var(--radius-pill)',
          transition: 'width 900ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}
