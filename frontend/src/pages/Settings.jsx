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
  const [lastReport, setLastReport] = useState(null)
  const [showSkippedReasons, setShowSkippedReasons] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch initial settings & source counts
  useEffect(() => {
    async function loadSettingsData() {
      const [settRes, recRes, reportRes] = await Promise.all([
        api.getSettings(),
        api.getRecords(365),
        api.getLastImportReport(),
      ])

      if (settRes.data) {
        setStepGoal(settRes.data.step_goal ?? 8000)
        setSleepGoal(settRes.data.sleep_goal ?? 7.0)
        setVoiceEnabled(settRes.data.voice_enabled ?? true)
        setNotifEnabled(settRes.data.notifications_enabled ?? true)
        updateSettings(settRes.data)
      }

      if (reportRes?.data) {
        setLastReport(reportRes.data)
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

    const {
      days_added,
      days_total,
      sources: importedSources,
      skipped_rows = [],
      skipped_count = 0,
      rows_read = 0,
      rows_used = 0,
      date_range,
      num_days,
    } = data

    setLastReport(data)

    const rangeStr =
      date_range?.start && date_range?.end
        ? ` (${date_range.start} to ${date_range.end})`
        : ''
    const skippedStr =
      skipped_count > 0
        ? `, ${skipped_count} row(s) skipped`
        : ', 0 skipped'

    addToast(
      `Imported: ${rows_used} of ${rows_read} rows used${skippedStr}${rangeStr}. Total ${num_days || days_total} days in timeline.`,
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

          {/* Last Import Report */}
          {lastReport && (
            <div className="import-report-box">
              <div className="import-report-header">
                <div className="import-report-title-row">
                  <CheckCircle size={16} className="text-success" />
                  <strong className="import-report-title">Last Import Report</strong>
                </div>
                {lastReport.date_range?.start && lastReport.date_range?.end && (
                  <span className="import-report-date-badge">
                    {lastReport.date_range.start} to {lastReport.date_range.end}
                  </span>
                )}
              </div>

              <div className="import-report-stats-grid">
                <div className="import-report-stat">
                  <span className="stat-label">Rows Read</span>
                  <span className="stat-val">{lastReport.rows_read?.toLocaleString() ?? 0}</span>
                </div>
                <div className="import-report-stat">
                  <span className="stat-label">Rows Used</span>
                  <span className="stat-val stat-val-highlight">{lastReport.rows_used?.toLocaleString() ?? 0}</span>
                </div>
                <div className="import-report-stat">
                  <span className="stat-label">Days in Timeline</span>
                  <span className="stat-val">{lastReport.num_days?.toLocaleString() ?? lastReport.days_total ?? 0}</span>
                </div>
                <div className="import-report-stat">
                  <span className="stat-label">Skipped</span>
                  <span className={`stat-val ${lastReport.skipped_count > 0 ? 'text-warn' : 'text-success'}`}>
                    {lastReport.skipped_count || (lastReport.skipped_rows ? lastReport.skipped_rows.length : 0)}
                  </span>
                </div>
              </div>

              {lastReport.skipped_rows && lastReport.skipped_rows.length > 0 ? (
                <div className="import-report-skipped-section">
                  <button
                    type="button"
                    className="skipped-toggle-btn"
                    onClick={() => setShowSkippedReasons((prev) => !prev)}
                  >
                    <span>{showSkippedReasons ? 'Hide' : 'View'} reasons for {lastReport.skipped_rows.length} skipped row(s)</span>
                    <span className="toggle-arrow">{showSkippedReasons ? '▲' : '▼'}</span>
                  </button>
                  {showSkippedReasons && (
                    <ul className="skipped-reasons-list">
                      {lastReport.skipped_rows.map((item, idx) => (
                        <li key={idx} className="skipped-reason-item">
                          <span className="skipped-row-num">Row {item.row || idx + 1}:</span> {item.reason || JSON.stringify(item)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="import-report-clean-note">
                  ✓ Clean import: all parsed rows merged into your on-device health timeline.
                </div>
              )}
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

        {/* Small footer line */}
        <div className="settings-footer-line">
          <span>Demo data and CSV import only · Not medical advice</span>
        </div>
      </div>
    </div>
  )
}
