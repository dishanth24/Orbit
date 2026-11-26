import React, { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts'
import { Footprints, Moon, Heart, Smile, Droplets, TrendingUp } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import MetricChip from '../components/MetricChip'
import SkeletonCard from '../components/SkeletonCard'

const METRIC_DEFS = {
  steps: {
    id: 'steps',
    label: 'Steps',
    color: 'var(--steps)',
    unit: 'steps',
    icon: Footprints,
  },
  sleep_h: {
    id: 'sleep_h',
    label: 'Sleep',
    color: 'var(--sleep)',
    unit: 'hours',
    icon: Moon,
  },
  rhr: {
    id: 'rhr',
    label: 'Resting HR',
    color: 'var(--heart)',
    unit: 'bpm',
    icon: Heart,
  },
  mood: {
    id: 'mood',
    label: 'Mood',
    color: 'var(--mood)',
    unit: '/ 5',
    icon: Smile,
  },
  water_l: {
    id: 'water_l',
    label: 'Water',
    color: 'var(--water)',
    unit: 'L',
    icon: Droplets,
  },
}

// Format "2026-11-12" -> "Thu 12 Nov"
function formatFriendlyDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A'
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00')
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
  }
  return dateStr
}

export default function Trends() {
  const api = useApi()
  const { hasData } = useAppContext()

  const [days, setDays] = useState(30)
  const [primaryMetric, setPrimaryMetric] = useState('sleep_h')
  const [overlayMetric, setOverlayMetric] = useState('steps')
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState([])

  useEffect(() => {
    async function fetchTrendRecords() {
      setLoading(true)
      const { data } = await api.getRecords(days)
      setLoading(false)
      if (data) {
        const list = Array.isArray(data) ? data : (data.records || [])
        setRecords(list)
      }
    }
    fetchTrendRecords()
  }, [days])

  // Build chart dataset with primary and overlay metrics merged
  // Explicitly sort oldest to newest, left to right
  const chartData = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.map((r) => {
      const d = new Date(r.date + 'T00:00:00')
      return {
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fullDate: r.date,
        [primaryMetric]: r[primaryMetric] ?? null,
        ...(overlayMetric && overlayMetric !== primaryMetric
          ? { [overlayMetric]: r[overlayMetric] ?? null }
          : {}),
      }
    })
  }, [records, primaryMetric, overlayMetric])

  // Compute summary stats for the primary metric
  const summaryStats = useMemo(() => {
    const vals = records
      .map((r) => r[primaryMetric])
      .filter((v) => v !== null && v !== undefined)

    if (!vals.length) return null

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)

    // Best day: for resting HR, lower is better; for everything else, higher is better
    const bestVal = primaryMetric === 'rhr' ? min : max
    const bestRec = records.find((r) => r[primaryMetric] === bestVal)

    return {
      avg: Number(avg.toFixed(primaryMetric === 'steps' ? 0 : 1)),
      min,
      max,
      bestVal,
      bestDate: bestRec ? formatFriendlyDate(bestRec.date) : 'N/A',
    }
  }, [records, primaryMetric])

  const primaryConf = METRIC_DEFS[primaryMetric] || METRIC_DEFS.steps
  const overlayConf = overlayMetric ? METRIC_DEFS[overlayMetric] : null

  return (
    <div className="trends-page">
      {/* Header */}
      <div className="trends-header">
        <div>
          <h1 className="page-title">Cross-Metric Trends</h1>
          <p className="page-subtitle">
            Compare any two biomarkers on a dual-axis graph to uncover your circadian rhythms and sleep-energy dynamics.
          </p>
        </div>

        {/* Time Segmented Control */}
        <div className="segmented-control">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              className={`segment-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selectors Row */}
      <div className="card metric-pickers-card">
        {/* Primary Metric Picker */}
        <div className="picker-group">
          <span className="picker-label">Primary Metric (Left Axis):</span>
          <div className="metric-chips-wrap">
            {Object.values(METRIC_DEFS).map((conf) => (
              <button
                key={conf.id}
                className={`chip metric-chip-btn ${primaryMetric === conf.id ? 'active' : ''}`}
                style={{
                  '--m-color': conf.color,
                  borderColor: primaryMetric === conf.id ? conf.color : 'transparent',
                }}
                onClick={() => setPrimaryMetric(conf.id)}
              >
                <conf.icon size={14} />
                <span>{conf.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Overlay Metric Picker */}
        <div className="picker-group" style={{ marginTop: 12 }}>
          <span className="picker-label">Compare With (Right Axis):</span>
          <div className="metric-chips-wrap">
            <button
              className={`chip metric-chip-btn ${overlayMetric === null ? 'active' : ''}`}
              onClick={() => setOverlayMetric(null)}
            >
              None
            </button>
            {Object.values(METRIC_DEFS).map((conf) => {
              if (conf.id === primaryMetric) return null
              return (
                <button
                  key={conf.id}
                  className={`chip metric-chip-btn ${overlayMetric === conf.id ? 'active' : ''}`}
                  style={{
                    '--m-color': conf.color,
                    borderColor: overlayMetric === conf.id ? conf.color : 'transparent',
                  }}
                  onClick={() => setOverlayMetric(conf.id)}
                >
                  <conf.icon size={14} />
                  <span>{conf.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Dual-Axis Chart Card */}
      <div className="card trends-chart-card">
        <div className="chart-title-row">
          <div className="chart-series-legend">
            <span className="legend-tag" style={{ color: primaryConf.color }}>
              ● {primaryConf.label} (Area)
            </span>
            {overlayConf && (
              <span className="legend-tag" style={{ color: overlayConf.color }}>
                ● {overlayConf.label} (Line)
              </span>
            )}
          </div>
          <span className="chart-window-label">Last {days} days</span>
        </div>

        <div className="trend-canvas-wrap">
          {loading ? (
            <SkeletonCard height={320} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primaryConf.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={primaryConf.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(14,124,107,0.08)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                {/* Left Y Axis for Primary */}
                <YAxis
                  yAxisId="left"
                  stroke={primaryConf.color}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  orientation="left"
                />
                {/* Right Y Axis for Overlay */}
                {overlayConf && (
                  <YAxis
                    yAxisId="right"
                    stroke={overlayConf.color}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow)',
                  }}
                  labelFormatter={(label, payload) => {
                    const fullDate = payload?.[0]?.payload?.fullDate
                    return fullDate ? formatFriendlyDate(fullDate) : label
                  }}
                  formatter={(val, name) => {
                    const c = METRIC_DEFS[name] || {}
                    return [`${typeof val === 'number' ? val.toLocaleString() : val} ${c.unit || ''}`, c.label || name]
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey={primaryMetric}
                  stroke={primaryConf.color}
                  strokeWidth={2.5}
                  fill="url(#primaryGrad)"
                />
                {overlayConf && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={overlayMetric}
                    stroke={overlayConf.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: overlayConf.color }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary Row */}
        {summaryStats && (
          <div className="trends-summary-row">
            <div className="summary-col">
              <span className="summary-col-label">Average</span>
              <strong className="summary-col-val" style={{ color: primaryConf.color }}>
                {summaryStats.avg.toLocaleString()} {primaryConf.unit}
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-col-label">Minimum</span>
              <strong className="summary-col-val">
                {summaryStats.min.toLocaleString()} {primaryConf.unit}
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-col-label">Maximum</span>
              <strong className="summary-col-val">
                {summaryStats.max.toLocaleString()} {primaryConf.unit}
              </strong>
            </div>
            <div className="summary-col">
              <span className="summary-col-label">Best Day</span>
              <strong className="summary-col-val">
                {summaryStats.bestVal.toLocaleString()} {primaryConf.unit}
                <span className="summary-date-sub"> ({summaryStats.bestDate})</span>
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
