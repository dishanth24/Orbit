import React from 'react'

export function SkeletonCard({ height = 160, style = {} }) {
  return (
    <div
      className="card skeleton"
      style={{ height, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ width = '100%', height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 8, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonMetricCard() {
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SkeletonText width="60%" height={14} />
      <SkeletonText width="40%" height={36} />
      <SkeletonText width="80%" height={12} />
    </div>
  )
}

export default SkeletonCard
