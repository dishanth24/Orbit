import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Filter, AlertCircle, ArrowUpRight } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import InsightCard from '../components/InsightCard'
import SkeletonCard from '../components/SkeletonCard'
import Tagline from '../components/Tagline'

const FILTERS = [
  { id: 'all', label: 'All Insights' },
  { id: 'sleep_h', label: 'Sleep' },
  { id: 'steps', label: 'Activity' },
  { id: 'rhr', label: 'Heart' },
  { id: 'mood', label: 'Mood' },
]

export default function Insights() {
  const api = useApi()
  const { hasData } = useAppContext()

  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState([])
  const [headline, setHeadline] = useState('')
  const [score, setScore] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true)
      const { data, error } = await api.getInsights()
      setLoading(false)
      if (data) {
        setInsights(data.insights || [])
        setHeadline(data.headline || '')
        setScore(data.score)
      }
    }
    fetchInsights()
  }, [])

  const filteredInsights = insights.filter((item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'steps') return item.metric === 'steps'
    if (activeFilter === 'sleep_h') return item.metric === 'sleep' || item.metric === 'sleep_h'
    if (activeFilter === 'rhr') return item.metric === 'heart' || item.metric === 'rhr'
    if (activeFilter === 'mood') return item.metric === 'mood'
    return true
  })

  return (
    <div className="insights-page">
      {/* Header */}
      <div className="insights-header">
        <div>
          <h1 className="page-title">Explainable Insights</h1>
          <p className="page-subtitle">
            Deterministic patterns and cross-metric links computed on your device. Every insight cites exact numbers and the rule used.
          </p>
        </div>
      </div>

      {/* Headline banner */}
      {headline && (
        <div className="insights-headline-banner card">
          <Sparkles className="headline-icon" size={20} />
          <div>
            <strong className="headline-title">Weekly Digest:</strong>
            <p className="headline-text">{headline}</p>
          </div>
        </div>
      )}

      {/* Filter Chips */}
      <div className="filter-chips-row">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip filter-chip ${activeFilter === f.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Insights List */}
      {loading ? (
        <div className="insights-list-grid">
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="card empty-insights-card">
          <AlertCircle size={36} className="muted-icon" />
          <h3>No insights found for this filter</h3>
          <p className="muted-text">
            {!hasData
              ? 'Load demo data or upload CSV files from the Settings page to generate insights.'
              : 'There are currently no active flags or trends for this category.'}
          </p>
          {!hasData && (
            <Link to="/settings" className="btn-primary" style={{ marginTop: 12 }}>
              Go to Settings
            </Link>
          )}
        </div>
      ) : (
        <div className="insights-list-grid">
          {filteredInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
