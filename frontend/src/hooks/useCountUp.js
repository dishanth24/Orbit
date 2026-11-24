import { useState, useEffect, useRef } from 'react'

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(value, duration = 1100, decimals = 0) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(null)
  const prevValueRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        setDisplay(value)
        return
      }
    }

    const from = prevValueRef.current
    prevValueRef.current = value
    startRef.current = null

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    function step(timestamp) {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = from + (value - from) * eased
      setDisplay(parseFloat(current.toFixed(decimals)))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setDisplay(value)
      }
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration, decimals])

  return display
}
