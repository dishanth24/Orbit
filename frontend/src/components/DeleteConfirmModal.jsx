import React, { useState } from 'react'

export default function DeleteConfirmModal({ onConfirm, onCancel, isLoading = false }) {
  const [inputValue, setInputValue] = useState('')
  const confirmed = inputValue === 'DELETE'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="card"
        style={{
          padding: '32px 28px',
          maxWidth: 420,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          animation: 'fadeUp 0.3s ease both',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)', marginBottom: 8 }}>
            Delete Everything?
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            This will permanently delete all your health records, nudges, settings, and privacy ledger.
            This action <strong>cannot be undone</strong>.
          </p>
        </div>

        <div>
          <label
            htmlFor="delete-confirm"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}
          >
            Type <strong style={{ color: 'var(--danger)' }}>DELETE</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="DELETE"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--radius-input)',
              border: `1.5px solid ${confirmed ? 'var(--danger)' : 'var(--border)'}`,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--font)',
              fontSize: '1rem',
              outline: 'none',
              transition: 'border-color 300ms ease',
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={() => confirmed && onConfirm()}
            disabled={!confirmed || isLoading}
            style={{ opacity: confirmed ? 1 : 0.4, cursor: confirmed ? 'pointer' : 'not-allowed' }}
          >
            {isLoading ? 'Deleting…' : 'Delete Everything'}
          </button>
        </div>
      </div>
    </div>
  )
}
