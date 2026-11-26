import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Footprints, Moon, Heart, Smile, Droplets, Flame, ArrowRight,
  Sparkles, Upload, RefreshCw, ChevronRight, Check, HelpCircle, X, Info
} from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import ScoreRing from '../components/ScoreRing'
import CountUp from '../components/CountUp'
import DeltaChip from '../components/DeltaChip'
import ProgressBar from '../components/ProgressBar'
import SkeletonCard from '../components/SkeletonCard'
import Tagline from '../components/Tagline'
import NudgeCard from '../components/NudgeCard'

const METRIC_CONFIG = {
  steps: {
    label: 'Steps',
    icon: Footprints,
    color: 'var(--steps)',
    unit: 'steps',
    formula: 'Average of valid days in Window A vs Window B: (A - B) / B × 100',
  },
  sleep: {
    label: 'Sleep',
    icon: Moon,
    color: 'var(--sleep)',
    unit: 'hours',
    formula: 'Average nightly sleep duration in Window A vs Window B: (A - B) / B × 100',
  },
  heart: {
    label: 'Resting HR',
    icon: Heart,
    color: 'var(--heart)',
    unit: 'bpm',
    formula: 'Difference in resting heart rate: Window A bpm - Window B bpm',
  },
  mood: {
    label: 'Mood',
    icon: Smile,
    color: 'var(--mood)',
    unit: '/ 5',
    formula: 'Average mood rating (1-5 scale) in Window A vs Window B',
  },
  water: {
    label: 'Water',
    icon: Droplets,
    color: 'var(--water)',
    unit: 'L',
    formula: 'Daily hydration volume in Window A vs Window B',
  },
}

function StatCard({ metric, metricData, windowA, windowB, formatSleep = false }) {
  const conf = METRIC_CONFIG[metric] || {}
  const Icon = conf.icon || Footprints
  const color = conf.color || 'var(--brand)'
  const [showHelp, setShowHelp] = useState(false)
  const helpRef = useRef(null)

  const avgVal = metricData?.avg
  const priorAvg = metricData?.prior_avg
  const changeVal = metricData?.change
  const goalVal = metricData?.goal
  const goalPct = metricData?.goal_pct ?? (avgVal && goalVal ? Math.round((avgVal / goalVal) * 100) : 0)
  const insufficient = metricData?.insufficient || false

  useEffect(() => {
    function handleClickOutside(e) {
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setShowHelp(false)
      }
    }
    if (showHelp) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHelp])

  return (
    <div className="card stat-card">
      <div className="stat-card-header">
        <div className="stat-label-wrap">
          <div className="metric-icon-bubble" style={{ background: `${color}18`, color }}>
            <Icon size={18} />
          </div>
          <span className="stat-card-title">{conf.label}</span>
        </div>

        {/* Calculation Info Popover Button */}
        <div className="calc-help-anchor" ref={helpRef}>
          <button
            className="calc-help-btn"
            onClick={() => setShowHelp((prev) => !prev)}
            title="How is this calculated?"
            aria-label={`Calculation details for ${conf.label}`}
          >
            <HelpCircle size={15} />
          </button>

          {showHelp && (
            <div className="calc-help-popover card">
              <div className="popover-header">
                <strong>{conf.label} Calculation</strong>
                <button onClick={() => setShowHelp(false)} className="popover-close-btn">
                  <X size={14} />
                </button>
              </div>
              <div className="popover-body">
                <div className="calc-row">
                  <span className="calc-k">Window A (This Week):</span>
                  <span className="calc-v">
                    {windowA?.formatted_range || 'Current'} ({metricData?.n ?? 7} days used)
                  </span>
                </div>
                <div className="calc-row">
                  <span className="calc-k">This Week Average:</span>
                  <span className="calc-v bold">
                    {avgVal !== null && avgVal !== undefined
                      ? `${typeof avgVal === 'number' ? avgVal.toLocaleString() : avgVal} ${conf.unit}`
                      : 'Not enough data'}
                  </span>
                </div>
                <div className="calc-row">
                  <span className="calc-k">Window B (Prior Week):</span>
                  <span className="calc-v">
                    {windowB?.formatted_range || 'Previous'} ({metricData?.n_prior ?? 0} days used)
                  </span>
                </div>
                <div className="calc-row">
                  <span className="calc-k">Prior Average:</span>
                  <span className="calc-v">
                    {priorAvg !== null && priorAvg !== undefined
                      ? `${typeof priorAvg === 'number' ? priorAvg.toLocaleString() : priorAvg} ${conf.unit}`
                      : 'Not enough data'}
                  </span>
                </div>
                <div className="calc-formula-box">
                  <span className="calc-k">Formula:</span>
                  <p className="formula-text">{conf.formula}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stat-value-row">
        <span className="stat-big-number" style={{ color: 'var(--text)' }}>
          {insufficient || avgVal === null || avgVal === undefined ? (
            <span style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>Not enough data</span>
          ) : (
            <CountUp
              value={avgVal}
              decimals={metric === 'sleep' || metric === 'mood' || metric === 'water' ? 1 : 0}
              formatSleep={formatSleep}
            />
          )}
        </span>
        {!insufficient && avgVal !== null && (
          <span className="stat-unit">{conf.unit}</span>
        )}
      </div>

      {/* Change Chip */}
      <div className="stat-delta-row">
        <DeltaChip
          value={changeVal}
          metric={metric}
          insufficient={insufficient || metricData?.prior_insufficient}
          tooltip="vs the previous 7 days"
        />
      </div>

      {/* Goal Progress Bar */}
      {goalVal && !insufficient && (
        <div className="stat-progress-section">
          <div className="stat-goal-label">
            <span>Goal: {goalVal.toLocaleString()} {conf.unit}</span>
            <span className="goal-pct-text">{goalPct}% of goal</span>
          </div>
          <ProgressBar value={Math.min(100, goalPct)} color={color} />
        </div>
      )}
    </div>
  )
}

function OrbitHero({ insightsData }) {
  const [showScoreInfo, setShowScoreInfo] = useState(false)
  const scoreInfoRef = useRef(null)

  const m = insightsData?.metrics || {}
  const score = m.orbit_score ?? (insightsData?.score ?? 0)
  const band = m.band || (insightsData?.band || 'Calculating orbit...')
  const headline = insightsData?.headline || 'Your personal health intelligence at a glance.'
  const streak = m.streak ?? (insightsData?.streak ?? 0)
  const scoreParts = m.score_parts || (insightsData?.score_parts || {})
  const windowLabel = m.window_a?.label || 'Based on 7 calendar days'

  const metricsObj = m.metrics || {}
  const orbs = [
    { id: 'steps', label: 'Steps', val: metricsObj.steps?.avg, disp: metricsObj.steps?.avg ? `${metricsObj.steps.avg.toLocaleString()}` : '--', color: 'var(--steps)', icon: Footprints },
    { id: 'sleep', label: 'Sleep', val: metricsObj.sleep?.avg, disp: metricsObj.sleep?.avg ? `${metricsObj.sleep.avg}h` : '--', color: 'var(--sleep)', icon: Moon },
    { id: 'heart', label: 'HR',    val: metricsObj.heart?.avg, disp: metricsObj.heart?.avg ? `${metricsObj.heart.avg} bpm` : '--', color: 'var(--heart)', icon: Heart },
    { id: 'mood',  label: 'Mood',  val: metricsObj.mood?.avg,  disp: metricsObj.mood?.avg ? `${metricsObj.mood.avg}/5` : '--', color: 'var(--mood)', icon: Smile },
    { id: 'water', label: 'Water', val: metricsObj.water?.avg, disp: metricsObj.water?.avg ? `${metricsObj.water.avg}L` : '--', color: 'var(--water)', icon: Droplets },
  ]

  useEffect(() => {
    function handleClickOutside(e) {
      if (scoreInfoRef.current && !scoreInfoRef.current.contains(e.target)) {
        setShowScoreInfo(false)
      }
    }
    if (showScoreInfo) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showScoreInfo])

  return (
    <section className="orbit-hero-one-row card">
      {/* 1. Left: Tagline, short summary headline, chips & Proof */}
      <div className="hero-col-left">
        <Tagline size="hero" />
        <p className="hero-one-sentence">{headline}</p>

        <div className="hero-chips-row">
          <span className="hero-band-chip">{band}</span>
          <span className="hero-streak-chip">
            <Flame size={15} className="flame-icon" />
            <CountUp value={streak} /> day streak
          </span>
        </div>

        {/* Proof under the hero */}
        <div className="hero-proof-badge" title="Exact data coverage used for this week">
          <Info size={14} className="proof-info-icon" />
          <span>{windowLabel}</span>
        </div>
      </div>

      {/* 2. Middle: Orbit Score Ring with Info Popover */}
      <div className="hero-col-middle" ref={scoreInfoRef}>
        <div className="score-ring-anchor">
          <ScoreRing score={score} size={148} />
          <button
            className="score-weights-trigger"
            onClick={() => setShowScoreInfo((prev) => !prev)}
            title="View Score weights breakdown"
            aria-label="View Score weights breakdown"
          >
            <HelpCircle size={14} />
            <span>Weights</span>
          </button>
        </div>

        {showScoreInfo && (
          <div className="score-weights-popover card">
            <div className="popover-header">
              <strong>Orbit Score Weights (0-100)</strong>
              <button onClick={() => setShowScoreInfo(false)} className="popover-close-btn">
                <X size={14} />
              </button>
            </div>
            <div className="popover-body">
              <div className="calc-row">
                <span className="calc-k" style={{ color: 'var(--steps)' }}>● Steps:</span>
                <span className="calc-v">{scoreParts.steps ?? 0} / 30 pts</span>
              </div>
              <div className="calc-row">
                <span className="calc-k" style={{ color: 'var(--sleep)' }}>● Sleep Duration:</span>
                <span className="calc-v">{scoreParts.sleep ?? 0} / 30 pts</span>
              </div>
              <div className="calc-row">
                <span className="calc-k" style={{ color: 'var(--heart)' }}>● Resting Heart Rate:</span>
                <span className="calc-v">{scoreParts.heart ?? 0} / 15 pts</span>
              </div>
              <div className="calc-row">
                <span className="calc-k" style={{ color: 'var(--mood)' }}>● Mood Index:</span>
                <span className="calc-v">{scoreParts.mood ?? 0} / 15 pts</span>
              </div>
              <div className="calc-row">
                <span className="calc-k" style={{ color: 'var(--brand)' }}>● Goal Consistency:</span>
                <span className="calc-v">{scoreParts.consistency ?? 0} / 10 pts</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right: Fixed non-overlapping orbs with gentle float */}
      <div className="hero-col-right">
        <div className="orbs-fixed-cluster">
          {orbs.map((orb, i) => (
            <div
              key={orb.id}
              className={`fixed-cluster-orb orb-${orb.id}`}
              style={{
                borderColor: orb.color,
                background: `radial-gradient(circle at 35% 35%, #fff 0%, ${orb.color}22 60%, ${orb.color}44 100%)`,
                animationDelay: `${i * -1.5}s`,
              }}
              title={`${orb.label}: ${orb.disp}`}
            >
              <orb.icon size={17} style={{ color: orb.color }} />
              <span className="orb-metric-label">{orb.label}</span>
              <span className="orb-metric-val">{orb.disp}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function EmptyStateToday({ onLoadDemo, loadingDemo }) {
  const navigate = useNavigate()

  return (
    <div className="empty-state-card card">
      <div className="empty-state-art">
        <svg viewBox="0 0 240 180" width="220" height="160" aria-hidden="true">
          <ellipse cx="120" cy="90" rx="90" ry="40" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.4" />
          <ellipse cx="120" cy="90" rx="60" ry="70" fill="none" stroke="var(--sleep)" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
          <circle cx="120" cy="90" r="28" fill="url(#hero-gradient-empty)" />
          <circle cx="185" cy="80" r="10" fill="var(--steps)" opacity="0.8" />
          <circle cx="70" cy="115" r="8" fill="var(--heart)" opacity="0.8" />
          <circle cx="140" cy="30" r="7" fill="var(--mood)" opacity="0.8" />
          <defs>
            <linearGradient id="hero-gradient-empty" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0E7C6B" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#5B6CFF" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="empty-state-header">
        <Tagline size="hero" />
        <h2 className="empty-state-title">No health data yet</h2>
        <p className="empty-state-desc">
          Orbit is your privacy-first personal health intelligence. Load our curated 30-day realistic dataset or upload your own CSV exports to begin.
        </p>
      </div>

      <div className="empty-state-actions">
        <button
          className="btn-primary"
          onClick={onLoadDemo}
          disabled={loadingDemo}
          style={{ minWidth: 180 }}
        >
          {loadingDemo ? (
            <>
              <RefreshCw size={18} className="spin" />
              Loading demo...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Load demo data
            </>
          )}
        </button>

        <button className="btn-secondary" onClick={() => navigate('/settings')}>
          <Upload size={18} />
          Upload CSV
        </button>
      </div>
    </div>
  )
}

export default function Today() {
  const api = useApi()
  const { hasData, setHasData, settings } = useAppContext()
  const { addToast } = useToastContext()

  const [loading, setLoading] = useState(true)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [insightsData, setInsightsData] = useState(null)
  const [records, setRecords] = useState([])
  const [nudges, setNudges] = useState([])

  const loadData = async () => {
    setLoading(true)
    const [recRes, insRes, nudRes] = await Promise.all([
      api.getRecords(30),
      api.getInsights(),
      api.getNudges(),
    ])

    if (recRes.data) {
      const list = Array.isArray(recRes.data) ? recRes.data : recRes.data.records || []
      setRecords(list)
      setHasData(list.length > 0)
    }
    if (insRes.data) {
      setInsightsData(insRes.data)
    }
    if (nudRes.data) {
      setNudges(nudRes.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    const { error } = await api.loadDemo()
    setLoadingDemo(false)
    if (error) {
      addToast(error, 'error')
      return
    }
    addToast('30 days loaded! Welcome to Orbit.', 'success')
    await loadData()
  }

  const m = insightsData?.metrics || {}
  const windowA = m.window_a
  const windowB = m.window_b
  const metricsMap = m.metrics || {}

  // 7-day chronological charts (oldest to newest left to right)
  const last7Records = useMemo(() => {
    if (!records.length) return []
    // Take the 7 records and sort chronologically ascending
    return [...records].slice(-7).sort((a, b) => a.date.localeCompare(b.date))
  }, [records])

  const stepsChartData = useMemo(() => {
    return last7Records.map((r) => {
      const d = new Date(r.date + 'T00:00:00')
      return {
        date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }),
        steps: r.steps ?? 0,
      }
    })
  }, [last7Records])

  const sleepChartData = useMemo(() => {
    return last7Records.map((r) => {
      const d = new Date(r.date + 'T00:00:00')
      return {
        date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }),
        sleep_h: Number((r.sleep_h ?? 0).toFixed(1)),
      }
    })
  }, [last7Records])

  const activeNudge = nudges.find((n) => n.status === 'pending')
  const latestInsight = insightsData?.insights?.[0]

  if (loading) {
    return (
      <div className="today-page-skeleton">
        <SkeletonCard height={240} />
        <div className="bento-grid-5">
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </div>
        <div className="bento-grid-2">
          <SkeletonCard height={240} />
          <SkeletonCard height={240} />
        </div>
      </div>
    )
  }

  if (!hasData || records.length === 0) {
    return <EmptyStateToday onLoadDemo={handleLoadDemo} loadingDemo={loadingDemo} />
  }

  return (
    <div className="today-page">
      {/* 1. Orbit Hero in One Row */}
      <OrbitHero insightsData={insightsData} />

      {/* 2. Stat Cards Grid (Values read strictly from canonical metrics) */}
      <div className="stat-cards-grid">
        <StatCard
          metric="steps"
          metricData={metricsMap.steps}
          windowA={windowA}
          windowB={windowB}
        />
        <StatCard
          metric="sleep"
          metricData={metricsMap.sleep}
          windowA={windowA}
          windowB={windowB}
          formatSleep={true}
        />
        <StatCard
          metric="heart"
          metricData={metricsMap.heart}
          windowA={windowA}
          windowB={windowB}
        />
        <StatCard
          metric="mood"
          metricData={metricsMap.mood}
          windowA={windowA}
          windowB={windowB}
        />
        <StatCard
          metric="water"
          metricData={metricsMap.water}
          windowA={windowA}
          windowB={windowB}
        />
      </div>

      {/* 3. 7-Day Chronological Charts (Oldest to newest, left to right, dashed goal line) */}
      <div className="bento-charts-grid">
        {/* Steps 7-Day Chart */}
        <div className="card chart-bento-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">7-Day Steps</h3>
              <span className="chart-subtitle">Goal: {(settings.step_goal || 8000).toLocaleString()} steps</span>
            </div>
            <span className="series-pill" style={{ color: 'var(--steps)', background: 'rgba(15,163,143,0.12)' }}>
              ● Daily steps
            </span>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={stepsChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(14,124,107,0.06)' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow)',
                  }}
                  formatter={(val) => [`${Number(val).toLocaleString()} steps`, 'Steps']}
                />
                <ReferenceLine
                  y={settings.step_goal || 8000}
                  stroke="var(--steps)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
                <Bar dataKey="steps" fill="var(--steps)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sleep 7-Day Area Chart */}
        <div className="card chart-bento-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">7-Day Sleep Duration</h3>
              <span className="chart-subtitle">Goal: {settings.sleep_goal || 7}h optimal window</span>
            </div>
            <span className="series-pill" style={{ color: 'var(--sleep)', background: 'rgba(108,123,255,0.12)' }}>
              ● Hours slept
            </span>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={sleepChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sleep-area-grad-v3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sleep)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--sleep)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={11} domain={[0, 10]} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow)',
                  }}
                  formatter={(val) => [`${val}h`, 'Sleep']}
                />
                <ReferenceLine
                  y={settings.sleep_goal || 7}
                  stroke="var(--sleep)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
                <Area
                  type="monotone"
                  dataKey="sleep_h"
                  stroke="var(--sleep)"
                  strokeWidth={2.5}
                  fill="url(#sleep-area-grad-v3)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Action Row: Today's Nudge + Latest Insight Teaser */}
      <div className="bento-action-row">
        {/* Nudge card */}
        <div className="nudge-bento-column">
          <div className="section-label-row">
            <span className="section-title-label">Today's Nudge</span>
            <Link to="/nudges" className="view-all-link">
              All nudges <ChevronRight size={14} />
            </Link>
          </div>
          {activeNudge ? (
            <NudgeCard
              nudge={activeNudge}
              onDone={() => setNudges((prev) => prev.filter((n) => n.id !== activeNudge.id))}
              onSnooze={() => setNudges((prev) => prev.filter((n) => n.id !== activeNudge.id))}
            />
          ) : (
            <div className="card all-good-card">
              <Check size={22} className="check-all-icon" />
              <div>
                <strong>All caught up!</strong>
                <p className="muted-text">No pending nudges for today. Keep up your healthy orbit.</p>
              </div>
            </div>
          )}
        </div>

        {/* Latest Insight Teaser */}
        <div className="insight-teaser-column">
          <div className="section-label-row">
            <span className="section-title-label">Latest Insight</span>
            <Link to="/insights" className="view-all-link">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {latestInsight ? (
            <Link to="/insights" className="card insight-teaser-card">
              <div className="teaser-top">
                <span className="teaser-metric-badge" style={{ color: 'var(--brand)' }}>
                  {latestInsight.metric}
                </span>
                <span className="teaser-arrow">
                  <ArrowRight size={16} />
                </span>
              </div>
              <h4 className="teaser-title">{latestInsight.title}</h4>
              <p className="teaser-body">{latestInsight.body}</p>
            </Link>
          ) : (
            <div className="card all-good-card">
              <p className="muted-text">Upload or load data to reveal your body's hidden patterns.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
