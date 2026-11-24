import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ToastProvider } from './ToastContext'

const AppContext = createContext(null)

const DEFAULT_SETTINGS = {
  step_goal: 8000,
  sleep_goal: 7.0,
  voice_enabled: false,
  theme: 'light',
  name: '',
}

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [hasData, setHasData] = useState(false)
  const [offline, setOffline] = useState(false)

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  return (
    <AppContext.Provider value={{
      settings,
      updateSetting,
      updateSettings,
      hasData,
      setHasData,
      offline,
      setOffline,
    }}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

export default AppContext
