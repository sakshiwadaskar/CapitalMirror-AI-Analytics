import type { Assumptions, BusinessInsights, FinancialData } from '@/types';

// Same convention as the web frontend's VITE_API_URL, just Expo's own
// EXPO_PUBLIC_ prefix — Expo CLI inlines this at bundle time, so it must be
// a static `process.env.EXPO_PUBLIC_API_URL` reference (no dynamic lookup).
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ParseResponse {
  data: FinancialData;
}

export async function parseText(text: string): Promise<FinancialData> {
  const res = await fetch(`${BASE}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Parse failed: ${res.status}`);
  }
  const body: ParseResponse = await res.json();
  return body.data;
}

export interface RationaleResult {
  rationale: string;
  insights: BusinessInsights;
}

export async function fetchRationale(
  data: FinancialData,
  assumptions: Assumptions,
  score: number,
  signal?: AbortSignal
): Promise<RationaleResult> {
  const res = await fetch(`${BASE}/rationale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, assumptions, score }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Rationale failed: ${res.status}`);
  }
  const json = await res.json();
  return {
    rationale: json.rationale,
    insights: json.insights ?? { whats_working: [], whats_not: [], fix_first: [] },
  };
}
