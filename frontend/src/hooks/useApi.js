import { useCallback } from 'react'
import { useAppContext } from '../context/AppContext'

const BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function useApi() {
  const { setOffline } = useAppContext()

  const call = useCallback(async (fn) => {
    try {
      const result = await fn()
      setOffline(false)
      return { data: result, error: null }
    } catch (err) {
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        setOffline(true)
      }
      return { data: null, error: err.message }
    }
  }, [setOffline])

  const loadDemo = () => call(() => request('/demo', { method: 'POST' }))

  const getRecords = (days = 30) =>
    call(async () => {
      const res = await request(`/records?days=${days}`)
      return Array.isArray(res) ? res : (res.records || [])
    })

  const getInsights = () => call(() => request('/insights'))

  const getTrends = (metric = 'steps', days = 30) =>
    call(() => request(`/trends?metric=${metric}&days=${days}`))

  const askQuestion = (question) =>
    call(() => request('/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }))

  const getNudges = () => call(() => request('/nudges'))

  const markNudgeDone = (id) =>
    call(() => request(`/nudges/${id}/done`, { method: 'POST' }))

  const snoozeNudge = (id, until) =>
    call(() => request(`/nudges/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ until }),
    }))

  const getPrivacyPayload = () => call(() => request('/privacy/payload'))

  const approveSummary = () =>
    call(() => request('/ai/summary', {
      method: 'POST',
      body: JSON.stringify({ approved: true }),
    }))

  const getLedger = () => call(() => request('/ledger'))

  const exportData = async () => {
    try {
      const res = await fetch(BASE + '/export')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'orbit-export.json'
      a.click()
      URL.revokeObjectURL(url)
      setOffline(false)
      return { data: true, error: null }
    } catch (err) {
      if (err instanceof TypeError) setOffline(true)
      return { data: null, error: err.message }
    }
  }

  const deleteAll = () =>
    call(() => request('/all', { method: 'DELETE' }))

  const getSettings = () => call(() => request('/settings'))

  const updateSettings = (settings) =>
    call(() => request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }))

  const importCSV = (files) => {
    return call(async () => {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      const res = await fetch(BASE + '/import', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    })
  }

  return {
    loadDemo,
    getRecords,
    getInsights,
    getTrends,
    askQuestion,
    getNudges,
    markNudgeDone,
    snoozeNudge,
    getPrivacyPayload,
    approveSummary,
    getLedger,
    exportData,
    deleteAll,
    getSettings,
    updateSettings,
    importCSV,
  }
}
