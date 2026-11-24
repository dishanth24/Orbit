import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Footprints, Moon, Heart, Smile, Droplets, Flame, ArrowRight,
  Sparkles, Upload, RefreshCw, ChevronRight, Check
} from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea
} from 'recharts'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import { useVoice } from '../hooks/useVoice'
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
    defaultGoal: 8000,
  },
  sleep: {
    label: 'Sleep',
    icon: Moon,
    color: 'var(--sleep)',
    unit: 'hours',
    defaultGoal: 7.0,
  },
  heart: {
    label: 'Resting HR',
    icon: Heart,
    color: 'var(--heart)',
    unit: 'bpm',
    defaultGoal: 65,
  },
  mood: {
    label: 'Mood',
    icon: Smile,
    color: 'var(--mood)',
    unit: '/ 5',
    defaultGoal: 4.0,
  },
  water: {
    label: 'Water',
    icon: Droplets,
    color: 'var(--water)',
    unit: 'L',
    defaultGoal: 2.5,
  },
}

function OrbitHero({ insightsData, records, onRefresh }) {
  const score = insightsData?.score ?? 0
  const band = insightsData?.band || 'Calculating orbit...'
  const headline = insightsData?.headline || 'Your personal health intelligence at a glance.'
  const streak = insightsData?.streak || 0
  const scoreParts = insightsData?.score_parts || {}

  // Last recorded day values for the 5 orbiting orbs
  const latest = records?.[0] || {}
  const orbs = [
    {
      id: 'steps',
      label: 'Steps',
      val: latest.steps ?? 0,
      disp: (latest.steps ?? 0).toLocaleString(),
      goal: 8000,
      color: 'var(--steps)',
      icon: Footprints,
      angle: 0,
    },
    {
      id: 'sleep',
      label: 'Sleep',
      val: latest.sleep_h ?? 0,
      disp: `${Math.floor(latest.sleep_h || 0)}h ${Math.round(((latest.sleep_h || 0) % 1) * 60)}m`,
      goal: 7.0,
      color: 'var(--sleep)',
      icon: Moon,
      angle: 72,
    },
    {
      id: 'heart',
      label: 'HR',
      val: latest.rhr ?? 68,
      disp: `${latest.rhr ?? '--'} bpm`,
      goal: 65,
      color: 'var(--heart)',
      icon: Heart,
      angle: 144,
    },
    {
      id: 'mood',
      label: 'Mood',
      val: latest.mood ?? 3,
      disp: `${latest.mood ? latest.mood.toFixed(1) : '--'}/5`,
      goal: 4.0,
      color: 'var(--mood)',
      icon: Smile,
      angle: 216,
    },
    {
      id: 'water',
      label: 'Water',
      val: latest.water_l ?? 0,
      disp: `${(latest.water_l ?? 0).toFixed(1)}L`,
      goal: 2.5,
      color: 'var(--water)',
      icon: Droplets,
      angle: 288,
    },
  ]

  return (
    <section className="orbit-hero-card">
      <div className="hero-header-row">
        <div className="hero-tagline-wrap">
          <Tagline size="hero" />
        </div>
        <div className="hero-streak-pill" title="Current Goal Streak">
          <Flame size={18} className="flame-icon" />
          <span>
            <CountUp value={streak} /> day streak
          </span>
        </div>
      </div>

      <p className="hero-headline">{headline}</p>

      {/* Orbit Visualization Arena */}
      <div className="orbit-arena">
        {/* Track ellipses */}
        <div className="orbit-track-ring" />
        <div className="orbit-track-ring-inner" />

        {/* Orbit Rotating System */}
        <div className="orbiting-system">
          {orbs.map((orb, index) => {
            const pct = Math.min(1.2, Math.max(0.4, orb.val / (orb.goal || 1)))
            const orbSize = Math.round(44 + (pct - 0.4) * 35) // 44px to 76px
            const initialAngle = (index * 72)

            return (
              <div
                key={orb.id}
                className="orb-carrier"
                style={{
                  '--start-angle': `${initialAngle}deg`,
                  '--carrier-radius-x': '155px',
                  '--carrier-radius-y': '115px',
                }}
              >
                <div
                  className="metric-orb"
                  style={{
                    width: orbSize,
                    height: orbSize,
                    background: `radial-gradient(circle at 35% 35%, #fff 0%, ${orb.color} 75%)`,
                    boxShadow: `0 4px 18px ${orb.color}55`,
                  }}
                  title={`${orb.label}: ${orb.disp} (${Math.round((orb.val / orb.goal) * 100)}% of goal)`}
                >
                  <div className="orb-counter-rotate">
                    <orb.icon size={orbSize > 56 ? 18 : 14} color="#fff" />
                    <span className="orb-value-text">{orb.disp}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Center Ring: Orbit Score */}
        <div className="center-score-wrap">
          <ScoreRing score={score} size={190} />
          <div className="score-band-badge">{band}</div>
        </div>
      </div>

      {/* Score breakdown strip */}
      <div className="score-breakdown-strip">
        <span className="breakdown-label">Score weights:</span>
        <span className="breakdown-item" style={{ color: 'var(--steps)' }}>
          Steps <strong>{scoreParts.steps ? Math.round(scoreParts.steps * 30) : 0}/30</strong>
        </span>
        <span className="breakdown-dot">•</span>
        <span className="breakdown-item" style={{ color: 'var(--sleep)' }}>
          Sleep <strong>{scoreParts.sleep ? Math.round(scoreParts.sleep * 30) : 0}/30</strong>
        </span>
        <span className="breakdown-dot">•</span>
        <span className="breakdown-item" style={{ color: 'var(--heart)' }}>
          Heart <strong>{scoreParts.heart ? Math.round(scoreParts.heart * 15) : 0}/15</strong>
        </span>
        <span className="breakdown-dot">•</span>
        <span className="breakdown-item" style={{ color: 'var(--mood)' }}>
          Mood <strong>{scoreParts.mood ? Math.round(scoreParts.mood * 15) : 0}/15</strong>
        </span>
        <span className="breakdown-dot">•</span>
        <span className="breakdown-item" style={{ color: 'var(--brand)' }}>
          Consistency <strong>{scoreParts.consistency ? Math.round(scoreParts.consistency * 10) : 0}/10</strong>
        </span>
      </div>
    </section>
  )
}

function StatCard({ metric, currentVal, unit, delta, deltaPct, sparklineData, goal, formatSleep = false }) {
  const conf = METRIC_CONFIG[metric] || {}
  const Icon = conf.icon || Footprints
  const color = conf.color || 'var(--brand)'
  const progressPct = goal ? Math.min(100, Math.round((currentVal / goal) * 100)) : null

  return (
    <div className="card stat-card">
      <div className="stat-card-header">
        <div className="stat-label-wrap">
          <div className="metric-icon-bubble" style={{ background: `${color}18`, color }}>
            <Icon size={18} />
          </div>
          <span className="stat-card-title">{conf.label}</span>
        </div>
        {deltaPct !== undefined && <DeltaChip value={deltaPct} suffix="%" />}
      </div>

      <div className="stat-value-row">
        <span className="stat-big-number" style={{ color: 'var(--text)' }}>
          <CountUp
            value={currentVal || 0}
            decimals={metric === 'sleep' || metric === 'mood' || metric === 'water' ? 1 : 0}
            formatSleep={formatSleep}
          />
        </span>
        <span className="stat-unit">{unit || conf.unit}</span>
      </div>

      {progressPct !== null && (
        <div className="stat-progress-section">
          <div className="stat-goal-label">
            <span>Goal: {goal} {conf.unit}</span>
            <span>{progressPct}%</span>
          </div>
          <ProgressBar value={progressPct} color={color} />
        </div>
      )}

      {sparklineData && sparklineData.length > 0 && (
        <div className="stat-sparkline-wrap">
          <ResponsiveContainer width="100%" height={45}>
            <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`spark-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#spark-${metric})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
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

        <button
          className="btn-secondary"
          onClick={() => navigate('/settings')}
        >
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
  const { speak } = useVoice()
  const navigate = useNavigate()

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
      const list = Array.isArray(recRes.data) ? recRes.data : (recRes.data.records || [])
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
    const { data, error } = await api.loadDemo()
    setLoadingDemo(false)
    if (error) {
      addToast(error, 'error')
      return
    }
    addToast('30 days loaded! Welcome to Orbit.', 'success')
    speak('Welcome to Orbit. Thirty days of health data loaded.')
    await loadData()
  }

  // Pre-calculate 7-day chart data
  const last7Records = useMemo(() => {
    return [...records].slice(-7).reverse()
  }, [records])

  const stepsChartData = useMemo(() => {
    return last7Records.map((r) => {
      const d = new Date(r.date + 'T00:00:00')
      return {
        date: d.toLocaleDateString(undefined, { weekday: 'short' }),
        steps: r.steps ?? 0,
      }
    })
  }, [last7Records])

  const sleepChartData = useMemo(() => {
    return last7Records.map((r) => {
      const d = new Date(r.date + 'T00:00:00')
      return {
        date: d.toLocaleDateString(undefined, { weekday: 'short' }),
        sleep_h: Number((r.sleep_h ?? 0).toFixed(1)),
      }
    })
  }, [last7Records])

  // Sparkline data for each metric (7 data points)
  const stepsSpark = useMemo(() => last7Records.map((r) => ({ value: r.steps ?? 0 })), [last7Records])
  const sleepSpark = useMemo(() => last7Records.map((r) => ({ value: r.sleep_h ?? 0 })), [last7Records])
  const heartSpark = useMemo(() => last7Records.map((r) => ({ value: r.rhr ?? 65 })), [last7Records])
  const moodSpark = useMemo(() => last7Records.map((r) => ({ value: r.mood ?? 3 })), [last7Records])
  const waterSpark = useMemo(() => last7Records.map((r) => ({ value: r.water_l ?? 0 })), [last7Records])

  // Latest daily values & deltas
  const latest = records[0] || {}
  const prev7AvgSteps = useMemo(() => {
    const p7 = records.slice(7, 14).map((r) => r.steps).filter(Boolean)
    return p7.length ? p7.reduce((a, b) => a + b, 0) / p7.length : latest.steps
  }, [records, latest])

  const stepsDeltaPct = prev7AvgSteps
    ? Math.round((((latest.steps || 0) - prev7AvgSteps) / prev7AvgSteps) * 100)
    : 0

  const activeNudge = nudges.find((n) => n.status === 'pending')
  const latestInsight = insightsData?.insights?.[0]

  if (loading) {
    return (
      <div className="today-page-skeleton">
        <SkeletonCard height={320} />
        <div className="bento-grid-4">
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </div>
        <div className="bento-grid-2">
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
      </div>
    )
  }

  if (!hasData || records.length === 0) {
    return <EmptyStateToday onLoadDemo={handleLoadDemo} loadingDemo={loadingDemo} />
  }

  return (
    <div className="today-page">
      {/* 1. Orbit Hero */}
      <OrbitHero insightsData={insightsData} records={records} onRefresh={loadData} />

      {/* 2. Stat Cards Grid (4 key metrics + water mini) */}
      <div className="stat-cards-grid">
        <StatCard
          metric="steps"
          currentVal={latest.steps ?? 0}
          deltaPct={stepsDeltaPct}
          sparklineData={stepsSpark}
          goal={settings.step_goal || 8000}
        />
        <StatCard
          metric="sleep"
          currentVal={latest.sleep_h ?? 0}
          formatSleep={true}
          sparklineData={sleepSpark}
          goal={settings.sleep_goal || 7.0}
        />
        <StatCard
          metric="heart"
          currentVal={latest.rhr ?? 68}
          sparklineData={heartSpark}
          goal={65}
        />
        <StatCard
          metric="mood"
          currentVal={latest.mood ?? 3.5}
          sparklineData={moodSpark}
          goal={4.0}
        />
        <StatCard
          metric="water"
          currentVal={latest.water_l ?? 2.0}
          sparklineData={waterSpark}
          goal={2.5}
        />
      </div>

      {/* 3. Bento Section: Charts + Nudge & Insight */}
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stepsChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(14,124,107,0.06)' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow)',
                  }}
                  formatter={(val) => [`${val.toLocaleString()} steps`, 'Steps']}
                />
                <ReferenceLine
                  y={settings.step_goal || 8000}
                  stroke="var(--steps)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
                <Bar dataKey="steps" fill="var(--steps)" radius={[8, 8, 0, 0]} />
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
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sleepChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sleep-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sleep)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--sleep)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
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
                  fill="url(#sleep-area-grad)"
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
