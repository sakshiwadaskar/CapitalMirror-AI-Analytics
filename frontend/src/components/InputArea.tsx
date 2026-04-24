import { useState, useRef, useCallback } from 'react'
import { parseText, parseFile } from '../lib/api'
import type { FinancialData } from '../types'

interface Props {
  onParsed: (data: FinancialData) => void
}

const SAMPLE = `Business: Riverside Landscaping LLC · FY 2023
Revenue: $1,840,000
COGS (labor + materials): $1,102,000
Gross Profit: $738,000 (40.1%)
Operating Expenses: $312,000
  — Owner salary: $120,000
  — Rent: $36,000
  — Marketing: $28,000
  — Misc: $128,000
EBITDA: $426,000
Owner SDE: ~$546,000
YoY Revenue Growth: +14%
Employees: 11 FT, 4 seasonal
Notes: Lost one major HOA contract in Q4. New equipment lease starts Jan 2024.`

type Tab = 'paste' | 'upload'

export function InputArea({ onParsed }: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmitText() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      onParsed(await parseText(text))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      onParsed(await parseFile(file))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [])

  const canAnalyze = tab === 'paste' ? text.trim().length > 0 : false

  return (
    <div className="w-full max-w-xl mx-auto">

      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-600 hover:text-red-900 transition-colors cursor-default">
          Business Health Dashboard
        </p>
        <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
          What's your business<br />actually worth?
        </h1>
        <p className="text-slate-500 text-sm">
          Drop in your P&L. Get a score, insights, and what to fix — in under 60 seconds.
        </p>
      </div>

      {/* Input card */}
      <div
        className="rounded-2xl border"
        style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)' }}
      >
        {/* Tab switcher */}
        <div className="flex border-b" style={{ borderColor: 'var(--ct-border)' }}>
          {(['paste', 'upload'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3.5 text-sm font-semibold transition-colors relative"
              style={{
                color: tab === t ? '#ffffff' : '#64748b',
                backgroundColor: 'transparent',
              }}
            >
              {t === 'paste' ? '📋  Paste Text' : '📁  Upload File'}
              {tab === t && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: 'var(--ct-maroon)' }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Paste tab */}
          {tab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Your P&L, revenue data, or financial summary
                </label>
                <textarea
                  className="w-full h-56 text-slate-100 text-sm rounded-xl p-4 border focus:outline-none resize-none transition-colors"
                  style={{
                    backgroundColor: '#111110',
                    borderColor: 'var(--ct-border)',
                    fontFamily: 'ui-monospace, monospace',
                    lineHeight: '1.6',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--ct-maroon)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--ct-border)')}
                  placeholder={`Paste anything — messy is fine. For example:\n\nRevenue: $1,840,000\nCOGS: $1,102,000\nOwner salary: $120,000\nYoY Growth: +14%\n...`}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>
              <button
                className="w-full text-xs text-left transition-colors"
                style={{ color: '#64748b' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#b5605a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                onClick={() => setText(SAMPLE)}
              >
                ↓ Load example — Riverside Landscaping LLC (FY 2023)
              </button>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div
              className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: dragOver ? 'var(--ct-maroon)' : 'var(--ct-border)',
                backgroundColor: dragOver ? 'rgba(115,23,24,0.08)' : '#111110',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="text-3xl mb-3">📄</div>
              <p className="text-slate-300 font-semibold text-sm mb-1">
                Drop your file here, or click to browse
              </p>
              <p className="text-slate-600 text-xs">CSV, PDF, or plain text — up to 10MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.pdf,.txt"
                className="hidden"
                onChange={onFileInput}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{ backgroundColor: '#1a0a0a', border: '1px solid var(--ct-maroon)', color: '#f6c6c3' }}
            >
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            className="w-full mt-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-colors disabled:opacity-30"
            style={{ backgroundColor: 'var(--ct-black)', color: '#fff', border: '1px solid var(--ct-border)' }}
            onMouseEnter={e => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--ct-maroon)'
                e.currentTarget.style.borderColor = 'var(--ct-maroon)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--ct-black)'
              e.currentTarget.style.borderColor = 'var(--ct-border)'
            }}
            onClick={tab === 'paste' ? handleSubmitText : () => fileRef.current?.click()}
            disabled={loading || (tab === 'paste' && !canAnalyze)}
          >
            {loading ? 'Analyzing your business...' : 'Get My Score →'}
          </button>
        </div>
      </div>

      {/* What you'll get */}
      <div className="mt-6 flex justify-center gap-6 text-xs text-slate-600">
        {['Health Score 0–100', 'What\'s Working / Not', 'Key Metrics + Chart'].map(item => (
          <span key={item} className="flex items-center gap-1.5">
            <span style={{ color: 'var(--ct-maroon)' }}>✓</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
