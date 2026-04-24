import { describe, it, expect } from 'vitest'
import { computeHealthScore } from '../../lib/scoring'
import type { FinancialData, Assumptions } from '../../types'

// Riverside Landscaping — the canonical sample from the CT brief
const RIVERSIDE: FinancialData = {
  business_name: 'Riverside Landscaping LLC',
  fiscal_year: '2023',
  revenue: 1_840_000,
  cogs: 1_102_000,
  gross_profit: 738_000,
  operating_expenses: 312_000,
  owner_salary: 120_000,
  rent: 36_000,
  marketing: 28_000,
  ebitda: 426_000,
  sde: 546_000,
  yoy_growth: 0.14,
  employee_count: 15,
  notes: null,
  industry: 'landscaping',
}

const DEFAULT_ASSUMPTIONS: Assumptions = {
  owner_salary: 120_000,
  growth_rate: 0.14,
  cogs_adjustment: 0,
  opex_adjustment: 0,
}

// ─── Derived metrics ────────────────────────────────────────────────────────

describe('computeHealthScore — derived metrics', () => {
  it('calculates gross margin correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    expect(metrics.gross_margin_pct).toBeCloseTo(0.4011, 3)
  })

  it('calculates gross profit correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    expect(metrics.gross_profit).toBeCloseTo(738_000, 0)
  })

  it('calculates expense ratio correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    // 312000 / 738000
    expect(metrics.expense_ratio).toBeCloseTo(0.4228, 3)
  })

  it('calculates SDE correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    // ebitda 426000 + owner_salary 120000
    expect(metrics.sde).toBe(546_000)
  })

  it('calculates SDE ratio correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    // 546000 / 1840000
    expect(metrics.sde_ratio).toBeCloseTo(0.2967, 3)
  })

  it('calculates monthly burn correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    // (1102000 + 312000) / 12
    expect(metrics.monthly_burn).toBeCloseTo(117_833, 0)
  })

  it('calculates projected revenue correctly', () => {
    const { metrics } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    // 1840000 * 1.14
    expect(metrics.projected_revenue).toBeCloseTo(2_097_600, 0)
  })
})

// ─── Score components (industry-relative) ───────────────────────────────────

describe('computeHealthScore — industry-relative scoring', () => {
  it('Riverside Landscaping scores 91/100', () => {
    const { score } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    expect(score).toBe(91)
  })

  it('same gross margin scores higher for restaurant than for SaaS', () => {
    const base = { ...RIVERSIDE, revenue: 1_000_000, cogs: 600_000, gross_profit: 400_000, operating_expenses: 150_000, ebitda: 250_000, owner_salary: 80_000 }
    const assumptions = { ...DEFAULT_ASSUMPTIONS, owner_salary: 80_000, growth_rate: 0.05 }

    const restaurant = computeHealthScore({ ...base, industry: 'restaurant' }, assumptions)
    const saas = computeHealthScore({ ...base, industry: 'saas' }, assumptions)

    // 40% gross margin is excellent for a restaurant, terrible for SaaS
    expect(restaurant.breakdown.gross_margin_score).toBeGreaterThan(saas.breakdown.gross_margin_score)
  })

  it('falls back to general benchmark for unknown industry', () => {
    const unknown = computeHealthScore({ ...RIVERSIDE, industry: 'plumbing' }, DEFAULT_ASSUMPTIONS)
    const general = computeHealthScore({ ...RIVERSIDE, industry: null }, DEFAULT_ASSUMPTIONS)
    expect(unknown.score).toBe(general.score)
  })

  it('above-range metric earns full component marks', () => {
    // 80% gross margin is way above any industry range
    const highMargin: FinancialData = { ...RIVERSIDE, cogs: 368_000, gross_profit: 1_472_000, industry: 'landscaping' }
    const { breakdown } = computeHealthScore(highMargin, DEFAULT_ASSUMPTIONS)
    expect(breakdown.gross_margin_score).toBe(30)
  })

  it('negative growth scores 0 growth points', () => {
    const declining = { ...DEFAULT_ASSUMPTIONS, growth_rate: -0.10 }
    const { breakdown } = computeHealthScore(RIVERSIDE, declining)
    expect(breakdown.growth_score).toBe(0)
  })

  it('expense ratio way above range scores 0 expense points', () => {
    // OpEx = 90% of gross profit is terrible
    const bloated: FinancialData = { ...RIVERSIDE, operating_expenses: 664_200 }
    const { breakdown } = computeHealthScore(bloated, DEFAULT_ASSUMPTIONS)
    expect(breakdown.expense_score).toBe(0)
  })
})

// ─── Assumption adjustments ──────────────────────────────────────────────────

describe('computeHealthScore — assumption adjustments', () => {
  it('COGS +10% lowers gross margin and score', () => {
    const base = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    const higher = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, cogs_adjustment: 0.10 })
    expect(higher.metrics.gross_margin_pct).toBeLessThan(base.metrics.gross_margin_pct)
    expect(higher.score).toBeLessThanOrEqual(base.score)
  })

  it('COGS -20% raises gross margin', () => {
    const base = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    const lower = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, cogs_adjustment: -0.20 })
    expect(lower.metrics.gross_margin_pct).toBeGreaterThan(base.metrics.gross_margin_pct)
  })

  it('OpEx +30% raises expense ratio', () => {
    const base = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    const higher = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, opex_adjustment: 0.30 })
    expect(higher.metrics.expense_ratio).toBeGreaterThan(base.metrics.expense_ratio)
  })

  it('SDE is invariant to owner salary slider when document has owner salary', () => {
    const base = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    const higher = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, owner_salary: 920_000 })
    expect(higher.metrics.sde).toBeCloseTo(base.metrics.sde, 0)
    expect(higher.metrics.sde_ratio).toBeCloseTo(base.metrics.sde_ratio, 4)
  })

  it('salary slider swaps salary inside OpEx — EBITDA shifts, SDE stays fixed', () => {
    // Case A: salary = $120K → EBITDA = $426K, SDE = $546K
    const caseA = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, owner_salary: 120_000 })
    expect(caseA.metrics.ebitda).toBeCloseTo(426_000, 0)
    expect(caseA.metrics.sde).toBeCloseTo(546_000, 0)

    // Case B: salary = $920K → EBITDA = −$374K, SDE still $546K
    const caseB = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, owner_salary: 920_000 })
    expect(caseB.metrics.ebitda).toBeCloseTo(-374_000, 0)
    expect(caseB.metrics.sde).toBeCloseTo(546_000, 0)
  })

  it('OpEx adjustment only scales non-salary OpEx, not the salary portion', () => {
    // Non-salary OpEx = $312K − $120K = $192K. +50% → $288K. Total opex = $288K + $120K = $408K.
    // If it incorrectly scaled full opex: $312K * 1.5 = $468K.
    const adjusted = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, opex_adjustment: 0.50 })
    expect(adjusted.metrics.operating_expenses).toBeCloseTo(408_000, 0)
  })

  it('high salary causes expense_ratio > 1 and drops expense score to 0', () => {
    const high = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, owner_salary: 920_000 })
    expect(high.metrics.expense_ratio).toBeGreaterThan(1)
    expect(high.breakdown.expense_score).toBe(0)
  })

  it('monthly burn includes assumed salary', () => {
    // opex = $192K + $920K = $1,112K; burn = (cogs $1,102K + opex $1,112K) / 12 = $184,500
    const high = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, owner_salary: 920_000 })
    expect(high.metrics.monthly_burn).toBeCloseTo(184_500, -2)
  })

  it('salary slider on data with no document owner_salary uses slider as the add-back', () => {
    const noSalary = { ...RIVERSIDE, owner_salary: null, operating_expenses: 192_000 }
    const result = computeHealthScore(noSalary, { ...DEFAULT_ASSUMPTIONS, owner_salary: 150_000 })
    // nonSalaryOpex = (192K - 0) = 192K; opex = 192K + 150K = 342K
    // ebitda = 738K - 342K = 396K; sde = 396K + 150K = 546K
    expect(result.metrics.sde).toBeCloseTo(546_000, 0)
  })

  it('growth_rate 0 → projected revenue equals revenue', () => {
    const flat = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, growth_rate: 0 })
    expect(flat.metrics.projected_revenue).toBe(flat.metrics.revenue)
  })

  it('growth_rate assumption drives yoy_growth metric', () => {
    const fast = computeHealthScore(RIVERSIDE, { ...DEFAULT_ASSUMPTIONS, growth_rate: 0.50 })
    expect(fast.metrics.yoy_growth).toBe(0.50)
  })
})

// ─── Null / missing field handling ──────────────────────────────────────────

describe('computeHealthScore — null field handling', () => {
  it('handles null revenue without throwing', () => {
    const empty: FinancialData = { business_name: null, fiscal_year: null, revenue: null, cogs: null, gross_profit: null, operating_expenses: null, owner_salary: null, rent: null, marketing: null, ebitda: null, sde: null, yoy_growth: null, employee_count: null, notes: null, industry: null }
    expect(() => computeHealthScore(empty, DEFAULT_ASSUMPTIONS)).not.toThrow()
  })

  it('null revenue with negative growth produces score of 0', () => {
    // growth_rate=-0.10 pushes growth score to 0; null revenue zeroes all other components
    const empty: FinancialData = { business_name: null, fiscal_year: null, revenue: null, cogs: null, gross_profit: null, operating_expenses: null, owner_salary: null, rent: null, marketing: null, ebitda: null, sde: null, yoy_growth: null, employee_count: null, notes: null, industry: null }
    const { score } = computeHealthScore(empty, { ...DEFAULT_ASSUMPTIONS, growth_rate: -0.10 })
    expect(score).toBe(0)
  })

  it('infers COGS from gross_profit when cogs is null', () => {
    const noCogs = { ...RIVERSIDE, cogs: null }
    const { metrics } = computeHealthScore(noCogs, DEFAULT_ASSUMPTIONS)
    // revenue - gross_profit = 1840000 - 738000 = 1102000
    expect(metrics.cogs).toBeCloseTo(1_102_000, 0)
  })

  it('infers EBITDA from gross_profit - opex when ebitda is null', () => {
    const noEbitda = { ...RIVERSIDE, ebitda: null }
    const { metrics } = computeHealthScore(noEbitda, DEFAULT_ASSUMPTIONS)
    // 738000 - 312000 = 426000
    expect(metrics.ebitda).toBeCloseTo(426_000, 0)
  })
})

// ─── Score total integrity ────────────────────────────────────────────────────

describe('computeHealthScore — score integrity', () => {
  it('score equals sum of breakdown components', () => {
    const { score, breakdown } = computeHealthScore(RIVERSIDE, DEFAULT_ASSUMPTIONS)
    const sum = breakdown.gross_margin_score + breakdown.sde_ratio_score + breakdown.growth_score + breakdown.expense_score
    expect(score).toBe(Math.round(sum))
  })

  it('score is always between 0 and 100', () => {
    const cases = [
      RIVERSIDE,
      { ...RIVERSIDE, revenue: 100, cogs: 200 },         // negative margin
      { ...RIVERSIDE, operating_expenses: 10_000_000 },  // absurd opex
    ]
    for (const d of cases) {
      const { score } = computeHealthScore(d, DEFAULT_ASSUMPTIONS)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('perfect business scores 100', () => {
    const perfect: FinancialData = {
      ...RIVERSIDE,
      revenue: 1_000_000,
      cogs: 50_000,          // 95% gross margin — way above any range
      gross_profit: 950_000,
      operating_expenses: 10_000, // tiny opex
      ebitda: 940_000,
      owner_salary: 50_000,
      industry: 'general',
    }
    const perfAssumptions = { owner_salary: 50_000, growth_rate: 0.50, cogs_adjustment: 0, opex_adjustment: 0 }
    const { score } = computeHealthScore(perfect, perfAssumptions)
    expect(score).toBe(100)
  })
})
