import React, { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import InsightCard from '../components/InsightCard'
import SkeletonCard from '../components/SkeletonCard'

export default function Insights() {
  const api = useApi()
  const { hasData } = useAppContext()

  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState([])
  const [windowInfo, setWindowInfo] = useState(null)

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true)
      const { data } = await api.getInsights()
      setLoading(false)
      if (data) {
        setInsights(data.insights || [])
        setWindowInfo(data.window_a)
      }
    }
    fetchInsights()
  }, [])

  // Group into: Needs attention, Going well, Good to know
  const needsAttention = insights.filter((i) => i.category === 'needs_attention')
  const goingWell = insights.filter((i) => i.category === 'going_well')
  const goodToKnow = insights.filter((i) => i.category === 'good_to_know')

  const totalCount = insights.length
  const topSummarySentence = `This week: ${needsAttention.length} needs attention, ${goingWell.length} going well, ${goodToKnow.length} good to know.`

  if (loading) {
    return (
      <div className="insights-page">
        <div className="insights-top-digest-skeleton">
          <SkeletonCard height={80} />
        </div>
        <div className="insights-list-grid">
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
        </div>
      </div>
    )
  }

  return (
    <div className="insights-page">
      {/* Top Digest Banner */}
      <div className="insights-top-digest card">
        <div className="digest-left">
          <span className="digest-headline-text">{topSummarySentence}</span>
          {windowInfo?.formatted_range && (
            <span className="digest-subtext">Based on 7-day analysis: {windowInfo.formatted_range}</span>
          )}
        </div>

        {/* 3 Count Chips */}
        <div className="digest-chips-group">
          <span className="digest-chip chip-attention" title="Needs attention count">
            <AlertTriangle size={14} />
            <strong>{needsAttention.length}</strong> Needs attention
          </span>
          <span className="digest-chip chip-going-well" title="Going well count">
            <CheckCircle2 size={14} />
            <strong>{goingWell.length}</strong> Going well
          </span>
          <span className="digest-chip chip-good-to-know" title="Good to know count">
            <Info size={14} />
            <strong>{goodToKnow.length}</strong> Good to know
          </span>
        </div>
      </div>

      {/* Insights Content by Group */}
      {totalCount === 0 ? (
        <div className="card empty-insights-card">
          <AlertCircle size={36} className="muted-icon" />
          <h3>No insights found yet</h3>
          <p className="muted-text">
            {!hasData
              ? 'Load demo data or upload CSV files in Settings to generate explainable findings.'
              : 'Add at least 3 days of health logs to reveal circadian and activity trends.'}
          </p>
        </div>
      ) : (
        <div className="insights-groups-container">
          {/* Group 1: Needs Attention */}
          {needsAttention.length > 0 && (
            <section className="insight-group-section">
              <div className="group-heading-row">
                <AlertTriangle size={17} color="var(--danger)" />
                <h2 className="group-title">Needs Attention</h2>
                <span className="group-count-badge">{needsAttention.length}</span>
              </div>
              <div className="group-cards-stack">
                {needsAttention.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
            </section>
          )}

          {/* Group 2: Going Well */}
          {goingWell.length > 0 && (
            <section className="insight-group-section">
              <div className="group-heading-row">
                <CheckCircle2 size={17} color="var(--success)" />
                <h2 className="group-title">Going Well</h2>
                <span className="group-count-badge">{goingWell.length}</span>
              </div>
              <div className="group-cards-stack">
                {goingWell.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
            </section>
          )}

          {/* Group 3: Good to Know */}
          {goodToKnow.length > 0 && (
            <section className="insight-group-section">
              <div className="group-heading-row">
                <Info size={17} color="var(--brand)" />
                <h2 className="group-title">Good to Know</h2>
                <span className="group-count-badge">{goodToKnow.length}</span>
              </div>
              <div className="group-cards-stack">
                {goodToKnow.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
