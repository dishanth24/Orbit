import React, { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warn)',
  info: 'var(--brand)',
}

export function Toast({ toast, onRemove }) {
  const { id, message, type, duration } = toast
  const Icon = ICONS[type] || Info
  const color = COLORS[type] || 'var(--brand)'

  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onRemove])

  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <Icon className="toast-icon" size={20} color={color} strokeWidth={2} />
      <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text)' }}>{message}</span>
      <button
        className="toast-close"
        onClick={() => onRemove(id)}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default Toast
