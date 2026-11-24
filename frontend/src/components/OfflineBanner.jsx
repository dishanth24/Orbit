import React, { useState } from 'react'
import { ServerCrash, RefreshCw } from 'lucide-react'
import { Tagline } from './Tagline'

export function OfflineBanner() {
  const [checking, setChecking] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)

  const retry = async () => {
    setChecking(true)
    setRetryFailed(false)
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        window.location.reload()
      } else {
        setRetryFailed(true)
      }
    } catch {
      setRetryFailed(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="offline-banner">
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(224,79,95,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
      }}>
        <ServerCrash size={40} color="var(--danger)" />
      </div>

      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Orbit is offline
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1rem', maxWidth: 400, lineHeight: 1.6 }}>
          Orbit can't reach its local server. Start the backend with{' '}
          <code style={{
            background: 'var(--brand-tint)',
            color: 'var(--brand)',
            padding: '2px 8px',
            borderRadius: 6,
            fontFamily: 'monospace',
          }}>
            uvicorn main:app
          </code>{' '}
          and try again.
        </p>
      </div>

      {retryFailed && (
        <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
          Still can't connect. Is the backend running on port 8000?
        </p>
      )}

      <button
        className="btn-primary"
        onClick={retry}
        disabled={checking}
        style={{ gap: 10 }}
      >
        <RefreshCw size={18} style={{ animation: checking ? 'spin 1s linear infinite' : undefined }} />
        {checking ? 'Checking...' : 'Retry connection'}
      </button>

      <div style={{ marginTop: 24 }}>
        <Tagline size="normal" />
      </div>
    </div>
  )
}

export default OfflineBanner
