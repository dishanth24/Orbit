import React from 'react'

export function Tagline({ size = 'normal' }) {
  const isHero = size === 'hero'

  const containerStyle = {
    display: 'inline-block',
    fontWeight: 400,
    fontSize: isHero ? '2.5rem' : '1rem',
    color: 'var(--muted)',
    lineHeight: 1.2,
  }

  const bodyStyle = {
    fontWeight: 700,
    background: 'var(--hero-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    position: 'relative',
    display: 'inline-block',
  }

  const swooshStyle = {
    position: 'absolute',
    bottom: isHero ? '-4px' : '-2px',
    left: 0,
    right: 0,
    height: isHero ? '3px' : '2px',
    background: 'var(--hero-gradient)',
    borderRadius: '2px',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2.5s infinite',
  }

  return (
    <span style={containerStyle}>
      Know your{' '}
      <span style={bodyStyle}>
        body
        <span style={swooshStyle} aria-hidden="true" />
      </span>
      .
    </span>
  )
}

export default Tagline
