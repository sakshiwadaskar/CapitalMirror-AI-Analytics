import type { FinancialData, Assumptions, BusinessInsights } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function parseText(text: string): Promise<FinancialData> {
  const res = await fetch(`${BASE}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return json.data
}

export async function parseFile(file: File): Promise<FinancialData> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/parse-file`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return json.data
}

export interface RationaleResult {
  rationale: string
  insights: BusinessInsights
}

export async function fetchRationale(
  data: FinancialData,
  assumptions: Assumptions,
  score: number
): Promise<RationaleResult> {
  const res = await fetch(`${BASE}/rationale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, assumptions, score }),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return {
    rationale: json.rationale,
    insights: json.insights ?? { whats_working: [], whats_not: [], fix_first: [] },
  }
}
