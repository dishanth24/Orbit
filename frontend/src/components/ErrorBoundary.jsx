import React from 'react'
import { AlertTriangle } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{
          padding: 32,
          margin: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(224,79,95,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertTriangle size={28} color="var(--danger)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 360 }}>
              This section encountered an error. Try refreshing the page.
            </p>
            {this.state.error && (
              <details style={{ marginTop: 12, textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.8rem' }}>
                  Error details
                </summary>
                <pre style={{
                  marginTop: 8,
                  padding: 12,
                  background: 'rgba(0,0,0,0.04)',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  color: 'var(--danger)',
                  overflow: 'auto',
                  maxHeight: 200,
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
          <button
            className="btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
