import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHealthScore } from '../../hooks/useHealthScore'
import type { FinancialData, Assumptions } from '../../types'

// Mock the Claude API call — unit tests must not hit the network
vi.mock('../../lib/api', () => ({
  fetchRationale: vi.fn().mockResolvedValue({
    rationale: 'Mock rationale.',
    insights: { whats_working: [], whats_not: [], fix_first: [] },
  }),
}))

const DATA: FinancialData = {
  business_name: 'Test Co',
  fiscal_year: '2023',
  revenue: 1_000_000,
  cogs: 600_000,
  gross_profit: 400_000,
  operating_expenses: 150_000,
  owner_salary: 80_000,
  rent: null,
  marketing: null,
  ebitda: 250_000,
  sde: 330_000,
  yoy_growth: 0.10,
  employee_count: null,
  cash_on_hand: null,
  notes: null,
  industry: 'general',
}

const ASSUMPTIONS: Assumptions = {
  owner_salary: 80_000,
  growth_rate: 0.10,
  cogs_adjustment: 0,
  opex_adjustment: 0,
}

beforeEach(() => vi.clearAllMocks())

describe('useHealthScore', () => {
  it('returns null healthScore when data is null', () => {
    const { result } = renderHook(() => useHealthScore(null, ASSUMPTIONS))
    expect(result.current.healthScore).toBeNull()
  })

  it('returns a non-null healthScore when data is provided', () => {
    const { result } = renderHook(() => useHealthScore(DATA, ASSUMPTIONS))
    expect(result.current.healthScore).not.toBeNull()
    expect(result.current.healthScore!.score).toBeGreaterThan(0)
  })

  // Regression: score must update synchronously (useMemo, not useEffect)
  it('score updates immediately when assumptions change — no stale render', () => {
    const { result, rerender } = renderHook(
      ({ data, assumptions }) => useHealthScore(data, assumptions),
      { initialProps: { data: DATA, assumptions: ASSUMPTIONS } }
    )
    const initialScore = result.current.healthScore!.score

    // Double the COGS — should immediately lower the score
    const worse = { ...ASSUMPTIONS, cogs_adjustment: 0.50 }
    rerender({ data: DATA, assumptions: worse })

    expect(result.current.healthScore!.score).toBeLessThan(initialScore)
  })

  it('resets rationale and insights when data becomes null', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: FinancialData | null }) => useHealthScore(data, ASSUMPTIONS),
      { initialProps: { data: DATA as FinancialData | null } }
    )
    rerender({ data: null })
    expect(result.current.healthScore).toBeNull()
    expect(result.current.rationale).toBe('')
    expect(result.current.insights.whats_working).toHaveLength(0)
  })

  it('score reflects assumption changes without requiring extra renders', () => {
    const { result, rerender } = renderHook(
      ({ assumptions }) => useHealthScore(DATA, assumptions),
      { initialProps: { assumptions: ASSUMPTIONS } }
    )

    const s1 = result.current.healthScore!.score

    rerender({ assumptions: { ...ASSUMPTIONS, growth_rate: 0.50 } })
    const s2 = result.current.healthScore!.score

    rerender({ assumptions: { ...ASSUMPTIONS, growth_rate: -0.20 } })
    const s3 = result.current.healthScore!.score

    // High growth > base > negative growth
    expect(s2).toBeGreaterThan(s1)
    expect(s3).toBeLessThan(s1)
  })
})
