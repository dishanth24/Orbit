/**
 * Canonical Orbit API client.
 * - Base URL from import.meta.env.VITE_API_URL or '/api'
 * - 75-second timeout
 * - Detects 502/503/504 and network disconnects as "backend waking"
 * - Dispatches 'orbit:waking' and 'orbit:awake' events
 */

const RAW_BASE = import.meta.env.VITE_API_URL || '/api'
export const BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE

export class BackendWakingError extends Error {
  constructor(message = 'Orbit is waking up') {
    super(message)
    this.name = 'BackendWakingError'
    this.isWaking = true
  }
}

export function notifyWaking() {
  window.dispatchEvent(new CustomEvent('orbit:waking'))
}

export function notifyAwake() {
  window.dispatchEvent(new CustomEvent('orbit:awake'))
}

export async function request(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 75000) // 75-second timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)

    // Check for sleeping/waking backend status codes
    if ([502, 503, 504].includes(res.status)) {
      notifyWaking()
      throw new BackendWakingError(`Backend server waking (HTTP ${res.status})`)
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    notifyAwake()
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'BackendWakingError') {
      throw err
    }
    // Check if network error or abort
    if (
      err.name === 'AbortError' ||
      (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
      err.message.includes('NetworkError')
    ) {
      notifyWaking()
      throw new BackendWakingError('Backend server waking up')
    }
    throw err
  }
}

/**
 * Download report (PDF or Excel) directly to the user's Downloads folder
 */
export async function downloadReportFile(type = 'pdf') {
  const endpoint = type === 'xlsx' ? '/report/xlsx' : '/report/pdf'
  const url = `${BASE_URL}${endpoint}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 75000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if ([502, 503, 504].includes(res.status)) {
      notifyWaking()
      throw new BackendWakingError()
    }
    if (!res.ok) {
      throw new Error(`Report generation failed (${res.status})`)
    }

    // Determine filename from Content-Disposition or fallback
    let filename = `orbit-report-${new Date().toISOString().slice(0, 10)}.${type}`
    const disp = res.headers.get('Content-Disposition')
    if (disp && disp.includes('filename=')) {
      const match = disp.match(/filename=["']?([^"']+)["']?/)
      if (match && match[1]) filename = match[1]
    }

    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)

    notifyAwake()
    return { filename }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'BackendWakingError') throw err
    if (err.name === 'AbortError' || (err instanceof TypeError && err.message.toLowerCase().includes('fetch'))) {
      notifyWaking()
      throw new BackendWakingError()
    }
    throw err
  }
}
