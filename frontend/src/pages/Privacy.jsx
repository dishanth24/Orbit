import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, Lock, Send, RefreshCw, Download, Trash2,
  CheckCircle, Sparkles, ExternalLink, AlertTriangle, FileText
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import { useVoice } from '../hooks/useVoice'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import SkeletonCard from '../components/SkeletonCard'

function JsonSyntaxHighlight({ data }) {
  if (!data) return <span className="muted-text">No payload data</span>

  const jsonStr = JSON.stringify(data, null, 2)
  // Simple syntax highligher with tokens
  const highlighted = jsonStr.split('\n').map((line, idx) => {
    // Key match
    const keyMatch = line.match(/^(\s*)(".*?")(\s*:)(.*)$/)
    if (keyMatch) {
      const [, indent, key, colon, value] = keyMatch
      const isNumber = /^-?\d+(\.\d+)?(,?)$/.test(value.trim())
      const isString = /^".*"(,?)$/.test(value.trim())
      const isBool = /^(true|false|null)(,?)$/.test(value.trim())

      let valClass = 'json-val-other'
      if (isNumber) valClass = 'json-val-number'
      if (isString) valClass = 'json-val-string'
      if (isBool) valClass = 'json-val-bool'

      return (
        <div key={idx} className="json-line">
          <span className="json-indent">{indent}</span>
          <span className="json-key">{key}</span>
          <span className="json-colon">{colon} </span>
          <span className={valClass}>{value.trim()}</span>
        </div>
      )
    }

    return (
      <div key={idx} className="json-line">
        <span className="json-bracket">{line}</span>
      </div>
    )
  })

  return <pre className="json-code-block">{highlighted}</pre>
}

export default function Privacy() {
  const api = useApi()
  const { setHasData } = useAppContext()
  const { addToast } = useToastContext()
  const { speak } = useVoice()
  const navigate = useNavigate()

  const [loadingPayload, setLoadingPayload] = useState(true)
  const [payload, setPayload] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loadingLedger, setLoadingLedger] = useState(true)

  // AI summary states
  const [allowAi, setAllowAi] = useState(false)
  const [sendingAi, setSendingAi] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchPayload = async () => {
    setLoadingPayload(true)
    const { data, error } = await api.getPrivacyPayload()
    setLoadingPayload(false)
    if (data) setPayload(data)
  }

  const fetchLedger = async () => {
    setLoadingLedger(true)
    const { data, error } = await api.getLedger()
    setLoadingLedger(false)
    if (data) setLedger(data)
  }

  useEffect(() => {
    fetchPayload()
    fetchLedger()
  }, [])

  const handleApproveSummary = async () => {
    if (!allowAi) return
    setSendingAi(true)
    const { data, error } = await api.approveSummary()
    setSendingAi(false)

    if (error) {
      addToast(error, 'error')
      return
    }

    setAiResult(data)
    addToast('Sent once. Recorded in your ledger.', 'success')
    speak('Sent once. Recorded in your ledger.')
    await fetchLedger()
  }

  const handleExport = async () => {
    const { error } = await api.exportData()
    if (error) {
      addToast(error, 'error')
    } else {
      addToast('Export downloaded: orbit-export.json', 'success')
    }
  }

  const handleDeleteAll = async () => {
    setDeleting(true)
    const { error } = await api.deleteAll()
    setDeleting(false)
    setShowDeleteModal(false)

    if (error) {
      addToast(error, 'error')
    } else {
      addToast('All data erased from local storage', 'info')
      setHasData(false)
      navigate('/')
    }
  }

  return (
    <div className="privacy-page">
      {/* 1. Shield Header */}
      <div className="privacy-hero-header">
        <div className="shield-anim-wrap">
          <svg viewBox="0 0 72 84" width="72" height="84" className="shield-svg" aria-hidden="true">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0E7C6B" />
                <stop offset="50%" stopColor="#14B8A6" />
                <stop offset="100%" stopColor="#5B6CFF" />
              </linearGradient>
            </defs>
            <path
              d="M36 4 L64 16 V40 C64 60 48 74 36 80 C24 74 8 60 8 40 V16 Z"
              fill="url(#shieldGrad)"
              opacity="0.15"
            />
            <path
              d="M36 4 L64 16 V40 C64 60 48 74 36 80 C24 74 8 60 8 40 V16 Z"
              fill="none"
              stroke="url(#shieldGrad)"
              strokeWidth="3"
              className="shield-stroke-path"
            />
            <path
              d="M26 42 L34 50 L48 34"
              fill="none"
              stroke="#0E7C6B"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shield-check-path"
            />
          </svg>
        </div>
        <div>
          <h1 className="privacy-hero-title">Privacy you can see.</h1>
          <p className="privacy-hero-subtitle">
            All analysis and scores are computed entirely on your device. Zero background telemetry.
            Nothing ever leaves your machine without your explicit one-time confirmation.
          </p>
        </div>
      </div>

      {/* 2. Side-by-Side Visual: Stays vs Leaves */}
      <div className="privacy-side-by-side-grid">
        <div className="card privacy-column-card local-column">
          <div className="column-card-header">
            <div className="column-icon-bubble local">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="column-title">Stays on your device</h3>
              <span className="column-subtitle">Never sent to any cloud server</span>
            </div>
          </div>
          <div className="chips-matrix">
            <span className="device-chip"><CheckCircle size={14} /> Full daily history (30+ days)</span>
            <span className="device-chip"><CheckCircle size={14} /> Exact timestamps &amp; dates</span>
            <span className="device-chip"><CheckCircle size={14} /> Raw CSV imports &amp; filenames</span>
            <span className="device-chip"><CheckCircle size={14} /> Personal mood ratings &amp; notes</span>
            <span className="device-chip"><CheckCircle size={14} /> Hour-by-hour metrics</span>
            <span className="device-chip"><CheckCircle size={14} /> On-device SQLite database</span>
          </div>
        </div>

        <div className="card privacy-column-card cloud-column">
          <div className="column-card-header">
            <div className="column-icon-bubble cloud">
              <Send size={18} />
            </div>
            <div>
              <h3 className="column-title">May leave (only if approved)</h3>
              <span className="column-subtitle">7 anonymized aggregate numbers only</span>
            </div>
          </div>
          <div className="chips-matrix">
            <span className="payload-key-chip">avg_steps</span>
            <span className="payload-key-chip">avg_sleep_hours</span>
            <span className="payload-key-chip">avg_resting_hr</span>
            <span className="payload-key-chip">steps_change_pct</span>
            <span className="payload-key-chip">short_sleep_nights</span>
            <span className="payload-key-chip">goal_streak_days</span>
            <span className="payload-key-chip">orbit_score</span>
          </div>
          <p className="privacy-note">No identifiers. No dates. No location. No raw rows.</p>
        </div>
      </div>

      {/* 3. Live Anonymized Payload Panel */}
      <div className="card privacy-payload-card">
        <div className="payload-card-header">
          <div>
            <h3 className="payload-title">Exact payload preview</h3>
            <span className="payload-subtitle">Live inspection of what would be transmitted</span>
          </div>
          <button className="btn-secondary btn-sm" onClick={fetchPayload} disabled={loadingPayload}>
            <RefreshCw size={14} className={loadingPayload ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="payload-viewer-wrap">
          {loadingPayload ? (
            <SkeletonCard height={160} />
          ) : (
            <JsonSyntaxHighlight data={payload} />
          )}
        </div>
      </div>

      {/* 4. AI Summary Approval Section */}
      <div className="card ai-summary-card">
        <div className="ai-summary-header">
          <div className="ai-summary-title-wrap">
            <Sparkles size={20} className="ai-sparkle-icon" />
            <div>
              <h3 className="ai-card-title">Optional AI Health Summary</h3>
              <span className="ai-card-subtitle">Generate an AI summary using the anonymized payload above</span>
            </div>
          </div>
          <label className="toggle-switch-label" title="Enable to allow sending the payload">
            <span className="toggle-text">Allow AI summary:</span>
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={allowAi}
              onChange={(e) => setAllowAi(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="ai-summary-actions">
          <button
            className="btn-primary"
            onClick={handleApproveSummary}
            disabled={!allowAi || sendingAi}
            title={!allowAi ? 'Turn on "Allow AI summary" toggle above to enable' : 'Send payload once for summary'}
          >
            {sendingAi ? (
              <>
                <RefreshCw size={16} className="spin" />
                Generating summary...
              </>
            ) : (
              <>
                <Send size={16} />
                Approve &amp; send once
              </>
            )}
          </button>
          {!allowAi && (
            <span className="approval-lock-hint">
              <Lock size={13} /> Gated by your explicit toggle above
            </span>
          )}
        </div>

        {/* AI Result Card */}
        {aiResult && (
          <div className="ai-result-box card">
            <div className="ai-result-badge-row">
              <span className={`ai-source-badge ${aiResult.source}`}>
                {aiResult.source === 'gemini' ? '✨ Gemini AI' : '🔒 Local fallback engine'}
              </span>
              <span className="ai-recorded-tag">Recorded in ledger ✓</span>
            </div>
            <p className="ai-summary-text">{aiResult.summary}</p>
          </div>
        )}
      </div>

      {/* 5. Privacy Ledger Table */}
      <div className="card privacy-ledger-card">
        <div className="ledger-header">
          <div>
            <h3 className="ledger-title">On-Device Privacy Ledger</h3>
            <span className="ledger-subtitle">Immutable log of every external transmission approval</span>
          </div>
          <button className="btn-secondary btn-sm" onClick={fetchLedger} disabled={loadingLedger}>
            <RefreshCw size={14} className={loadingLedger ? 'spin' : ''} />
          </button>
        </div>

        {loadingLedger ? (
          <SkeletonCard height={120} />
        ) : ledger.length === 0 ? (
          <div className="ledger-empty-state">
            <ShieldCheck size={40} className="shield-empty-icon" />
            <h4 className="ledger-empty-title">Nothing has ever left your device.</h4>
            <p className="ledger-empty-subtitle">Zero network packets sent. Your personal data is completely private.</p>
          </div>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>What was shared</th>
                  <th>Destination</th>
                  <th>User approval</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="ledger-ts">
                      {new Date(row.ts).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td><code className="ledger-code">{row.what}</code></td>
                    <td>
                      <span className="destination-badge">{row.destination}</span>
                    </td>
                    <td>
                      <span className="approval-check">
                        <CheckCircle size={14} /> Approved by you
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Export and Delete Controls */}
      <div className="card danger-zone-card">
        <div className="danger-zone-header">
          <div>
            <h3 className="danger-title">Data Sovereignty</h3>
            <span className="danger-subtitle">One-click data export or permanent on-device wipe</span>
          </div>
        </div>

        <div className="danger-actions-row">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} />
            Export my data (JSON)
          </button>

          <button className="btn-danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={16} />
            Delete everything
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteModal(false)}
          isLoading={deleting}
        />
      )}
    </div>
  )
}
