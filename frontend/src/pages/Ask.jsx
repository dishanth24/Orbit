import React, { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Sparkles, MessageCircleQuestion, CornerDownRight } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAppContext } from '../context/AppContext'
import { useToastContext } from '../context/ToastContext'
import EvidencePill from '../components/EvidencePill'
import Tagline from '../components/Tagline'

const DEFAULT_CHIPS = [
  'How did I sleep?',
  'Why am I tired?',
  'Steps this week?',
  'Best day?',
  "How's my score?",
  'What leaves my device?',
]

function TypingIndicator() {
  return (
    <div className="message-bubble assistant typing-bubble">
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

export default function Ask() {
  const api = useApi()
  const { hasData } = useAppContext()
  const { addToast } = useToastContext()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I am your local data intelligence assistant. Ask me anything about your steps, sleep patterns, heart rate, mood, water intake, or privacy.",
      evidence: {},
      followups: ['How did I sleep?', "How's my score?", 'What leaves my device?'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (questionText) => {
    const q = (questionText || input).trim()
    if (!q || loading) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Simulate natural typing rhythm between 400ms and 650ms
    const delay = Math.floor(Math.random() * 250) + 400

    setTimeout(async () => {
      const { data, error } = await api.askQuestion(q)
      setLoading(false)

      if (error) {
        addToast(error, 'error')
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: "Sorry, I had trouble processing that locally. Please try again.",
            evidence: {},
            followups: DEFAULT_CHIPS.slice(0, 3),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
        return
      }

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data?.answer || "I've reviewed your data.",
        evidence: data?.evidence || {},
        followups: data?.followups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    }, delay)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    addToast('Chat cleared', 'info')
  }

  return (
    <div className="ask-page">
      {/* Header with Title and Clear button */}
      <div className="ask-header-row">
        <div>
          <h1 className="page-title">Ask your data</h1>
          <p className="page-subtitle">Deterministic, on-device answers computed straight from your local database.</p>
        </div>
        {messages.length > 0 && (
          <button className="btn-secondary btn-sm" onClick={clearChat} title="Clear conversation">
            <Trash2 size={15} />
            <span>Clear chat</span>
          </button>
        )}
      </div>

      {/* Suggestion Chips Bar */}
      <div className="chips-scroll-bar">
        {DEFAULT_CHIPS.map((chip) => (
          <button
            key={chip}
            className="chip suggestion-chip"
            onClick={() => handleSend(chip)}
            disabled={loading}
          >
            <Sparkles size={13} className="chip-sparkle" />
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-container card">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <MessageCircleQuestion size={44} className="muted-icon" />
            <Tagline size="normal" />
            <p className="muted-text">Ask a question or tap one of the suggested prompts above.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.role}`}>
              <div className={`message-bubble ${msg.role}`}>
                <p className="message-text">{msg.text}</p>

                {/* Evidence Pills Strip */}
                {msg.evidence && Object.keys(msg.evidence).length > 0 && (
                  <div className="evidence-strip">
                    <span className="evidence-strip-label">Evidence:</span>
                    {Object.entries(msg.evidence).map(([key, val]) => {
                      let metric = 'steps'
                      if (key.includes('sleep')) metric = 'sleep'
                      if (key.includes('hr') || key.includes('rhr')) metric = 'heart'
                      if (key.includes('mood')) metric = 'mood'
                      if (key.includes('water')) metric = 'water'

                      const formattedKey = key.replace(/_/g, ' ')
                      const formattedVal = typeof val === 'number' ? val.toLocaleString() : String(val)

                      return (
                        <EvidencePill
                          key={key}
                          metric={metric}
                          label={formattedKey}
                          value={formattedVal}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Follow-up Chips for Assistant */}
                {msg.role === 'assistant' && msg.followups && msg.followups.length > 0 && (
                  <div className="followup-chips-row">
                    {msg.followups.map((fu, idx) => (
                      <button
                        key={idx}
                        className="followup-chip"
                        onClick={() => handleSend(fu)}
                        disabled={loading}
                      >
                        <CornerDownRight size={12} />
                        {fu}
                      </button>
                    ))}
                  </div>
                )}

                <span className="message-timestamp">{msg.timestamp}</span>
              </div>
            </div>
          ))
        )}

        {loading && <TypingIndicator />}
        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-bar card">
        <input
          type="text"
          className="chat-text-input"
          placeholder="Ask a question about your sleep, steps, heart rate..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />
        <button
          className="btn-primary send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          aria-label="Send question"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
