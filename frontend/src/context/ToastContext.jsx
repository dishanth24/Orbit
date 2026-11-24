import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const ctx = useContext(ToastContext)
  return ctx || { toasts: [], addToast: () => {}, removeToast: () => {} }
}

export const useToast = useToastContext

export default ToastContext
