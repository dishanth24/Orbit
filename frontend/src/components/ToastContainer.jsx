import React from 'react'
import { Toast } from './Toast'
import { useToast } from '../context/ToastContext'

export function ToastContainer(props) {
  const context = useToast() || {}
  const toasts = props?.toasts ?? context.toasts ?? []
  const removeToast = props?.removeToast ?? context.removeToast ?? (() => {})

  if (!toasts || !toasts.length) return null

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

export default ToastContainer
