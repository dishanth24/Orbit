import React, { useState, useEffect } from 'react'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info,
  ChevronDown, Footprints, Moon, Heart, Smile, Droplets, Flame, Activity
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import DeltaChip from '../components/DeltaChip'
import SkeletonCard from '../components/SkeletonCard'

// ─── helpers ────────────────────────────────────────────────────────────────

const METRIC_ICONS = {
  steps: Footprints,
  sleep: Moon,
  sleep_h: Moon,
  heart: Heart,
  rhr: Heart,
  mood: Smile,
  water: Droplets,
  water_l: Droplets,
  consistency: Flame,
}

const METRIC_COLORS = {
  steps: 'var(--steps)',
  sleep: 'var(--sleep)',
  sleep_h: 'var(--sleep)',
  heart: 'var(--heart)',
  rhr: 'var(--heart)',
  mood: 'var(--mood)',
  water: 'var(--water)',
  water_l: 'var(--water)',
  consistency: 'var(--warn)',
}

// Convert any "2026-11-12" to "Thu 12 Nov"
function friendlyDate(raw) {
  if (!raw || typeof raw !== 'string') return raw
  return raw.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => {
    const dt = new Date(`${y}-${m}-${d}T00:00:00`)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${weekdays[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
  })
}

function formatDayMonthRange(windowInfo) {
  if (!windowInfo) return null
  if (windowInfo.start && windowInfo.end) {
    const d1 = new Date(windowInfo.start + 'T00:00:00')
    const d2 = new Date(windowInfo.end + 'T00:00:00')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${d1.getDate()} ${months[d1.getMonth()]} to ${d2.getDate()} ${months[d2.getMonth()]}`
  }
  if (windowInfo.formatted_range && windowInfo.formatted_range !== 'No data') {
    return windowInfo.formatted_range.replace(' - ', ' to ')
  }
  return null
}

function formatEvVal(key, val) {
  if (typeof val === 'string') return friendlyDate(val)
  if (typeof val === 'number') return val.toLocaleString()
  return String(val)
}

function cleanWords(str, max) {
  if (!str) return ''
  const words = str.trim().split(/\s+/)
  if (words.length <= max) return str
  return words.slice(0, max).join(' ')
}

// Clean title and body so big numbers aren't duplicated and length stays concise
function formatCardContent(insight) {
  const ev = insight.evidence || {}
  let title = friendlyDate(insight.title || '')
  let body = friendlyDate(insight.body || '')

  switch (insight.id) {
    case 'steps_trend':
      if (insight.change !== null && insight.change !== undefined) {
        title = insight.change < 0 ? 'Steps are down' : insight.change > 0 ? 'Steps are up' : 'Steps are steady'
      } else {
        title = 'Steps trend'
      }
      if (ev.prior_week_avg !== undefined && ev.prior_week_avg !== null) {
        body = `Last week: ${ev.prior_week_avg.toLocaleString()} a day.`
      } else {
        body = '7-day daily activity average.'
      }
      break

    case 'short_sleep_nights':
      title = `${ev.short_nights ?? 2} short sleep nights`
      body = 'Nights under 6h recorded this week.'
      break

    case 'sleep_avg':
      title = 'Average sleep'
      body = ev.goal ? `Target: ${ev.goal}h per night.` : 'Optimal nightly sleep window.'
      break

    case 'hr_rise':
      if (insight.change !== null && insight.change !== undefined && insight.change < 0) {
        title = 'Resting heart rate improved'
      } else {
        title = 'Resting heart rate up'
      }
      if (ev.prior_week_bpm !== undefined && ev.prior_week_bpm !== null) {
        body = `Prior week average: ${ev.prior_week_bpm} bpm.`
      } else {
        body = 'Week-over-week resting heart rate change.'
      }
      break

    case 'goal_streak':
      title = 'Goal streak active'
      body = ev.step_goal ? `Daily goal: ${ev.step_goal.toLocaleString()} steps.` : 'Consecutive days hitting your daily target.'
      break

    case 'best_day':
      if (ev.date) {
        title = `Best day: ${friendlyDate(ev.date)}`
      } else {
        title = 'Peak activity day'
      }
      body = 'Highest daily step count recorded.'
      break

    case 'mood_dip':
      title = 'Mood dipped'
      if (ev.prior_week !== undefined && ev.prior_week !== null) {
        body = `Prior week average: ${ev.prior_week}/5.`
      } else {
        body = 'Week-over-week mood score comparison.'
      }
      break

    case 'orbit_status':
      title = 'Orbit Score'
      body = 'Computed across all 5 biomarker dimensions.'
      break

    default:
      title = cleanWords(title, 6)
      body = cleanWords(body, 12)
      break
  }

  return { title, body }
}

// ─── InsightCard Component ──────────────────────────────────────────────────

function InsightCard({ insight }) {
  const [open, setOpen] = useState(false)

  const metric = (insight.metric || 'steps').toLowerCase()
  const Icon = METRIC_ICONS[metric] || Activity
  const color = METRIC_COLORS[metric] || 'var(--brand)'
  const cat = insight.category || 'good_to_know'

  const catColor =
    cat === 'needs_attention'
      ? 'var(--danger)'
      : cat === 'going_well'
      ? 'var(--success)'
      : 'var(--brand)'

  const keyNum = insight.key_number
  const change = insight.change
  const { title, body } = formatCardContent(insight)

  // Format unit for key numbers
  let formattedKeyNum = keyNum
  if (typeof keyNum === 'number') {
    if (insight.id === 'sleep_avg' || insight.id === 'short_sleep_nights') {
      formattedKeyNum = `${keyNum}h`
    } else if (insight.id === 'hr_rise') {
      formattedKeyNum = `${keyNum} bpm`
    } else if (insight.id === 'mood_dip') {
      formattedKeyNum = `${keyNum}/5`
    } else if (insight.id === 'goal_streak') {
      formattedKeyNum = `${keyNum} days`
    } else {
      formattedKeyNum = keyNum.toLocaleString()
    }
  }

  const evidenceEntries = insight.evidence ? Object.entries(insight.evidence) : []

  return (
    <div className={`card ins-card ins-card--${cat}`}>
      {/* Top row: line icon and short title (max 6 words) */}
      <div className="ins-card__top">
        <div className="ins-card__icon" style={{ background: `${catColor}18`, color: catColor }}>
          <Icon size={17} strokeWidth={2} />
        </div>
        <span className="ins-card__title">{title}</span>
      </div>

      {/* Big number with its change chip beside it */}
      {keyNum !== undefined && keyNum !== null && (
        <div className="ins-card__metric-row">
          <span className="ins-card__number" style={{ color }}>
            {formattedKeyNum}
          </span>
          {change !== null && change !== undefined && (
            <DeltaChip value={change} metric={metric} tooltip="vs previous 7 days" />
          )}
        </div>
      )}

      {/* One muted sentence (max 12 words) */}
      {body && <p className="ins-card__body">{body}</p>}

      {/* Quiet text link "Why?" with a chevron */}
      {insight.rule && (
        <div className="ins-card__why-wrap">
          <button
            type="button"
            className="ins-card__why-btn"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <span>Why?</span>
            <ChevronDown size={13} className={`ins-why-chevron ${open ? 'rotated' : ''}`} />
          </button>

          {open && (
            <div className="ins-card__why-drawer">
              <p className="ins-why-rule">
                <strong>Rule:</strong> {insight.rule}
              </p>
              {evidenceEntries.length > 0 && (
                <div className="ins-why-evidence">
                  {evidenceEntries.map(([k, v]) => (
                    <div key={k} className="ins-why-ev-row">
                      <span className="ins-why-ev-key">{k.replace(/_/g, ' ')}:</span>
                      <span className="ins-why-ev-val">{formatEvVal(k, v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section Component ──────────────────────────────────────────────────────

function InsightSection({ title, Icon, iconColor, cards }) {
  if (!cards.length) return null

  return (
    <section className="ins-section">
      <div className="ins-section__heading">
        <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />
        <h3 className="ins-section__title">{title}</h3>
        <span className="ins-section__count">{cards.length}</span>
      </div>
      <div className="ins-cards-grid">
        {cards.map((ins) => (
          <InsightCard key={ins.id} insight={ins} />
        ))}
      </div>
    </section>
  )
}

// ─── Main Insights Page ─────────────────────────────────────────────────────

const MAX_CARDS = 6

export default function Insights() {
  const api = useApi()
  const { hasData } = useAppContext()

  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState([])
  const [windowInfo, setWindowInfo] = useState(null)

  useEffect(() => {
    async function fetchInsightsData() {
      setLoading(true)
      const { data } = await api.getInsights()
      setLoading(false)
      if (data) {
        setInsights(data.insights || [])
        setWindowInfo(data.window_a || null)
      }
    }
    fetchInsightsData()
  }, [])

  if (loading) {
    return (
      <div className="ins-page">
        <SkeletonCard height={80} />
        <div className="ins-cards-grid" style={{ marginTop: 20 }}>
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </div>
      </div>
    )
  }

  // 1. Deduplicate sleep: if "short sleep nights" exists, hide "Average sleep"
  const hasShortSleep = insights.some(
    (i) => i.id === 'short_sleep_nights' || i.rule === 'short_sleep_7d'
  )
  const deduplicated = insights.filter(
    (i) => !(hasShortSleep && (i.id === 'sleep_avg' || i.rule === 'sleep_avg_vs_goal'))
  )

  // 2. Limit to at most 6 cards
  const filtered = deduplicated.slice(0, MAX_CARDS)

  // 3. Partition filtered cards so counts strictly match cards shown
  const attention = filtered.filter((i) => i.category === 'needs_attention')
  const wellCards = filtered.filter((i) => i.category === 'going_well')
  const infoCards = filtered.filter((i) => i.category === 'good_to_know')

  // 4. Summary headline string
  const parts = []
  if (attention.length) parts.push(`${attention.length} need${attention.length > 1 ? '' : 's'} attention`)
  if (wellCards.length) parts.push(`${wellCards.length} going well`)
  if (infoCards.length) parts.push(`${infoCards.length} good to know`)
  const summaryText = parts.length ? `This week: ${parts.join(', ')}.` : 'No insights yet.'

  const dateRange = formatDayMonthRange(windowInfo)

  if (!filtered.length) {
    return (
      <div className="ins-page">
        <div className="card ins-empty">
          <AlertCircle size={36} color="var(--muted)" />
          <h3 style={{ marginTop: 12, marginBottom: 6 }}>No insights yet</h3>
          <p className="ins-empty__desc">
            {!hasData
              ? 'Load demo data or upload a CSV in Settings.'
              : 'Add at least 3 days of logs to reveal trends.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ins-page">
      {/* 1. Summary Card */}
      <div className="card ins-summary">
        <div className="ins-summary__left">
          <h2 className="ins-summary__headline">{summaryText}</h2>
          {dateRange && <span className="ins-summary__date">{dateRange}</span>}
        </div>

        {/* Small count chips with 8px gaps. Hide any chip with count of 0. */}
        <div className="ins-summary__chips">
          {attention.length > 0 && (
            <span className="ins-chip ins-chip--attention" title={`${attention.length} need attention`}>
              <AlertTriangle size={12} />
              <span>{attention.length}</span>
            </span>
          )}
          {wellCards.length > 0 && (
            <span className="ins-chip ins-chip--well" title={`${wellCards.length} going well`}>
              <CheckCircle2 size={12} />
              <span>{wellCards.length}</span>
            </span>
          )}
          {infoCards.length > 0 && (
            <span className="ins-chip ins-chip--info" title={`${infoCards.length} good to know`}>
              <Info size={12} />
              <span>{infoCards.length}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Grouped Sections */}
      <InsightSection
        title="Needs attention"
        Icon={AlertTriangle}
        iconColor="var(--danger)"
        cards={attention}
      />
      <InsightSection
        title="Going well"
        Icon={CheckCircle2}
        iconColor="var(--success)"
        cards={wellCards}
      />
      <InsightSection
        title="Good to know"
        Icon={Info}
        iconColor="var(--brand)"
        cards={infoCards}
      />
    </div>
  )
}
