import { useEffect, useRef, useState } from 'react'

function formatSleepValue(val) {
  const h = Math.floor(val)
  const m = Math.round((val - h) * 60)
  return `${h}h ${m}m`
}

export function useCountUp({ target, duration = 1100, decimals = 0, reducedMotion = false }) {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (reducedMotion) {
      setCurrent(target)
      return
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setCurrent(target)
      return
    }

    startTimeRef.current = null

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(parseFloat((eased * target).toFixed(decimals)))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setCurrent(target)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, decimals, reducedMotion])

  return current
}

export default function CountUp({
  value = 0,
  duration = 1100,
  decimals = 0,
  suffix = '',
  prefix = '',
  formatSleep = false,
  className = '',
}) {
  const current = useCountUp({ target: value, duration, decimals })

  const display = formatSleep
    ? formatSleepValue(current)
    : `${prefix}${decimals > 0 ? current.toFixed(decimals) : Math.round(current)}${suffix}`

  return <span className={`tabular ${className}`}>{display}</span>
}
