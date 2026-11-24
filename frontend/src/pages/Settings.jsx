import React, { useState, useEffect, useRef } from 'react'
import {
  Settings as SettingsIcon, Sliders, Database, Upload, Sparkles,
  Volume2, Bell, Moon, Sun, ShieldAlert, CheckCircle, RefreshCw, X, FileText
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import { useTheme } from '../hooks/useTheme'
import { useVoice } from '../hooks/useVoice'

export default function Settings() {
  const api = useApi()
  const { settings, updateSetting, updateSettings, setHasData } = useAppContext()
  const { addToast } = useToastContext()
  const [theme, toggleTheme] = useTheme()
  const { speak } = useVoice()

  // Stepper state
  const [stepGoal, setStepGoal] = useState(settings.step_goal || 8000)
  const [sleepGoal, setSleepGoal] = useState(settings.sleep_goal || 7.0)
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voice_enabled ?? true)
  const [notifEnabled, setNotifEnabled] = useState(settings.notifications_enabled ?? true)

  const [loadingDemo, setLoadingDemo] = useState(false)
  const [sources, setSources] = useState([])
  const [recordsCount, setRecordsCount] = useState(0)

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch initial settings & source counts
  useEffect(() => {
    async function loadSettingsData() {
      const [settRes, recRes] = await Promise.all([
        api.getSettings(),
        api.getRecords(365),
      ])

      if (settRes.data) {
        setStepGoal(settRes.data.step_goal ?? 8000)
        setSleepGoal(settRes.data.sleep_goal ?? 7.0)
        setVoiceEnabled(settRes.data.voice_enabled ?? true)
        setNotifEnabled(settRes.data.notifications_enabled ?? true)
        updateSettings(settRes.data)
      }

      if (recRes.data) {
        const list = Array.isArray(recRes.data) ? recRes.data : (recRes.data.records || [])
        setRecordsCount(list.length)
        // Extract distinct sources
        const allSources = new Set()
        list.forEach((r) => {
          if (r.sources) {
            r.sources.split(',').forEach((s) => allSources.add(s.trim()))
          }
        })
        setSources(Array.from(allSources))
      }
    }
    loadSettingsData()
  }, [])

  // Debounced auto-save for step and sleep goals
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timer = setTimeout(async () => {
      const { data, error } = await api.updateSettings({
        step_goal: stepGoal,
        sleep_goal: sleepGoal,
        voice_enabled: voiceEnabled,
        notifications_enabled: notifEnabled,
      })
      if (error) {
        addToast(error, 'error')
      } else {
        updateSettings({
          step_goal: stepGoal,
          sleep_goal: sleepGoal,
          voice_enabled: voiceEnabled,
          notifications_enabled: notifEnabled,
        })
        addToast('Goals and preferences saved', 'success')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [stepGoal, sleepGoal, voiceEnabled, notifEnabled])

  // Stepper handlers
  const handleStepDelta = (delta) => {
    setStepGoal((prev) => Math.max(1000, Math.min(50000, prev + delta)))
  }

  const handleSleepDelta = (delta) => {
    setSleepGoal((prev) => Number(Math.max(4.0, Math.min(12.0, prev + delta)).toFixed(1)))
  }

  // Load demo data
  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    const { data, error } = await api.loadDemo()
    setLoadingDemo(false)

    if (error) {
      addToast(error, 'error')
      return
    }

    addToast('30 days of realistic demo data loaded!', 'success')
    speak('Thirty days of demo data loaded.')
    setHasData(true)

    // Refresh record counts
    const recRes = await api.getRecords(365)
    if (recRes.data) {
      const list = Array.isArray(recRes.data) ? recRes.data : (recRes.data.records || [])
      setRecordsCount(list.length)
      setSources(['demo_phone_steps', 'demo_watch_sleep_hr', 'demo_mood_log', 'demo_water_log'])
    }
  }

  // File drag & drop handling
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    validateAndAddFiles(files)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    validateAndAddFiles(files)
  }

  const validateAndAddFiles = (files) => {
    const nonCsv = files.find((f) => !f.name.toLowerCase().endsWith('.csv'))
    if (nonCsv) {
      addToast(`"${nonCsv.name}" is not a CSV file. Only .csv files are supported.`, 'error')
      return
    }
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpload = async () => {
    if (!selectedFiles.length) return
    setUploading(true)

    const { data, error } = await api.importCSV(selectedFiles)
    setUploading(false)

    if (error) {
      addToast(error, 'error')
      return
    }

    const { days_added, days_total, sources: importedSources, skipped_rows } = data
    addToast(
      `Added ${days_added} days from ${selectedFiles.length} file(s) (${skipped_rows || 0} rows skipped). Total: ${days_total} days.`,
      'success'
    )
    speak(`CSV import complete. Added ${days_added} days.`)
    setSelectedFiles([])
    setHasData(true)

    // Refresh counts
    const recRes = await api.getRecords(365)
    if (recRes.data) {
      const list = Array.isArray(recRes.data) ? recRes.data : (recRes.data.records || [])
      setRecordsCount(list.length)
      if (importedSources) setSources(importedSources)
    }
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <h1 className="page-title">Settings &amp; Sources</h1>
        <p className="page-subtitle">Personalize your body targets, import watch exports, or manage on-device storage.</p>
      </div>

      <div className="settings-cards-stack">
        {/* 1. Daily Targets Section */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <Sliders size={20} className="settings-icon" />
            <div>
              <h3 className="settings-card-title">Personal Daily Targets</h3>
              <span className="settings-card-subtitle">Changes instantly recalibrate your Orbit Score</span>
            </div>
          </div>

          <div className="stepper-controls-grid">
            {/* Steps stepper */}
            <div className="stepper-box">
              <span className="stepper-label">Daily Steps Goal</span>
              <div className="stepper-row">
                <button
                  className="stepper-btn"
                  onClick={() => handleStepDelta(-500)}
                  aria-label="Decrease steps goal"
                >
                  -
                </button>
                <span className="stepper-value-display">
                  {stepGoal.toLocaleString()}
                  <span className="stepper-unit"> steps</span>
                </span>
                <button
                  className="stepper-btn"
                  onClick={() => handleStepDelta(500)}
                  aria-label="Increase steps goal"
                >
                  +
                </button>
              </div>
            </div>

            {/* Sleep stepper */}
            <div className="stepper-box">
              <span className="stepper-label">Sleep Target</span>
              <div className="stepper-row">
                <button
                  className="stepper-btn"
                  onClick={() => handleSleepDelta(-0.5)}
                  aria-label="Decrease sleep goal"
                >
                  -
                </button>
                <span className="stepper-value-display">
                  {sleepGoal.toFixed(1)}
                  <span className="stepper-unit"> hours</span>
                </span>
                <button
                  className="stepper-btn"
                  onClick={() => handleSleepDelta(0.5)}
                  aria-label="Increase sleep goal"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Data Sources & CSV Import */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <Database size={20} className="settings-icon" />
            <div>
              <h3 className="settings-card-title">Data Sources &amp; CSV Import</h3>
              <span className="settings-card-subtitle">
                Currently tracking: <strong>{recordsCount} daily records</strong> across {sources.length || 0} source stream(s)
              </span>
            </div>
          </div>

          {/* Quick Demo Loader */}
          <div className="demo-loader-banner">
            <div>
              <strong>Quick 30-Day Demo</strong>
              <p className="muted-text">
                Loads realistic sample data with 21 healthy days and 9 high-stress days to showcase all insights.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={handleLoadDemo}
              disabled={loadingDemo}
            >
              {loadingDemo ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Loading demo...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Load demo data
                </>
              )}
            </button>
          </div>

          {/* CSV Drag and Drop Box */}
          <div
            className={`dropzone-box ${isDragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".csv"
              style={{ display: 'none' }}
            />
            <Upload size={32} className="dropzone-icon" />
            <h4 className="dropzone-title">Drop your health CSV export files here</h4>
            <p className="dropzone-hint">
              Supports Apple Health, Google Fit, Garmin, Fitbit, or custom exports (Steps, Sleep, HR, Mood, Water).
            </p>
            <span className="btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
              Browse files
            </span>
          </div>

          {/* Staged files list */}
          {selectedFiles.length > 0 && (
            <div className="staged-files-list">
              <span className="staged-label">Staged for merge:</span>
              <div className="staged-chips">
                {selectedFiles.map((file, idx) => (
                  <span key={idx} className="staged-file-chip">
                    <FileText size={14} />
                    <span className="staged-file-name">{file.name}</span>
                    <span className="staged-file-size">({Math.round(file.size / 1024)} KB)</span>
                    <button
                      className="remove-file-btn"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading}
                style={{ marginTop: 12 }}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Merging files...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import &amp; Merge {selectedFiles.length} file(s)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 3. Toggles Section */}
        <div className="card settings-card">
          <div className="settings-card-header">
            <Volume2 size={20} className="settings-icon" />
            <div>
              <h3 className="settings-card-title">Preferences &amp; Toggles</h3>
              <span className="settings-card-subtitle">App experience and accessibility</span>
            </div>
          </div>

          <div className="settings-toggles-list">
            {/* Voice Confirmations */}
            <div className="toggle-row">
              <div className="toggle-info">
                <Volume2 size={18} />
                <div>
                  <strong>Voice confirmations</strong>
                  <p className="muted-text">Spoken voice feedback on nudges, demo loads, and approvals.</p>
                </div>
              </div>
              <label className="toggle-switch-label">
                <input
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => setVoiceEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Notifications */}
            <div className="toggle-row">
              <div className="toggle-info">
                <Bell size={18} />
                <div>
                  <strong>Nudge notifications</strong>
                  <p className="muted-text">Receive on-device desktop alerts when healthy goals are slipping.</p>
                </div>
              </div>
              <label className="toggle-switch-label">
                <input
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={notifEnabled}
                  onChange={(e) => setNotifEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Dark Theme */}
            <div className="toggle-row">
              <div className="toggle-info">
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                <div>
                  <strong>Dark theme</strong>
                  <p className="muted-text">Switch between deep dark aurora and mint-white themes.</p>
                </div>
              </div>
              <label className="toggle-switch-label">
                <input
                  type="checkbox"
                  className="toggle-checkbox"
                  checked={theme === 'dark'}
                  onChange={toggleTheme}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* 4. Honest Limits & About */}
        <div className="card settings-card about-card">
          <div className="settings-card-header">
            <ShieldAlert size={20} className="settings-icon" />
            <div>
              <h3 className="settings-card-title">About Orbit &amp; Honest Limits</h3>
              <span className="settings-card-subtitle">Built for wHACKiest 2026 (Know Thyself track)</span>
            </div>
          </div>

          <div className="about-text-content">
            <p>
              <strong>Orbit</strong> is a privacy-first personal health intelligence app. It merges phone and watch exports into one timeline, computes explainable insights locally, and never sends unapproved data to the cloud.
            </p>
            <div className="honest-limits-box">
              <strong>Honest product limits:</strong>
              <ul>
                <li>CSV file imports and demo data only. No direct Bluetooth or live cloud wearable sync.</li>
                <li>All analysis is deterministic and rule-based.</li>
                <li><strong>Not medical advice.</strong> This software is intended for informational and personal wellness tracking only.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
