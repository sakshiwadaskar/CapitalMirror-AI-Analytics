/**
 * Adversarial edge-case suite — four "broken" financial scenarios
 * designed to surface NaN, division-by-zero, and formula hallucinations.
 */
import { describe, it, expect } from 'vitest'
import { computeHealthScore } from '../../lib/scoring'
import type { FinancialData, Assumptions } from '../../types'

const BASE_ASSUMPTIONS: Assumptions = {
  owner_salary: 0,
  growth_rate: 0,
  cogs_adjustment: 0,
  opex_adjustment: 0,
}

function noNaN(metrics: Record<string, number>) {
  for (const [key, val] of Object.entries(metrics)) {
    expect(Number.isNaN(val), `${key} is NaN`).toBe(false)
    expect(Number.isFinite(val), `${key} is Infinite`).toBe(true)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Case 1 — Pre-Revenue Burn ($0 Revenue, $15K OpEx, $300K Cash)
// Goal: no crash, no NaN, EBITDA is negative, burn is correct.
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge Case 1 — Pre-Revenue Burn', () => {
  const PRE_REVENUE: FinancialData = {
    business_name: 'Startup Co', fiscal_year: '2024',
    revenue: 0, cogs: 0, gross_profit: 0,
    operating_expenses: 15_000, owner_salary: 0,
    rent: null, marketing: null, ebitda: null, sde: null,
    yoy_growth: null, employee_count: null, notes: null,
    industry: 'saas', cash_on_hand: 300_000,
  }

  it('does not throw', () => {
    expect(() => computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)).not.toThrow()
  })

  it('no metric is NaN or Infinite', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    noNaN(metrics as unknown as Record<string, number>)
  })

  it('score is a valid integer between 0 and 100', () => {
    const { score } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(Number.isNaN(score)).toBe(false)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('gross_margin_pct is 0 — not division-by-zero', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(metrics.gross_margin_pct).toBe(0)
  })

  it('expense_ratio defaults to 1 (not Infinity) when gross_profit is 0', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(metrics.expense_ratio).toBe(1)
  })

  it('sde_ratio is 0 — not division-by-zero', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(metrics.sde_ratio).toBe(0)
  })

  it('ebitda is −$15K (burning cash)', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(metrics.ebitda).toBe(-15_000)
  })

  it('monthly burn = $1,250 (opex / 12)', () => {
    const { metrics } = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    expect(metrics.monthly_burn).toBeCloseTo(1_250, 0)
  })

  it('SDE invariant across salary assumptions even at $0 revenue', () => {
    const base   = computeHealthScore(PRE_REVENUE, BASE_ASSUMPTIONS)
    const higher = computeHealthScore(PRE_REVENUE, { ...BASE_ASSUMPTIONS, owner_salary: 50_000 })
    expect(higher.metrics.sde).toBeCloseTo(base.metrics.sde, 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Case 2 — Accounting Error Paradox (COGS > Revenue, claimed GP is wrong)
// Goal: dashboard uses CALCULATED gross_profit (−$100K), not claimed ($100K).
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge Case 2 — Accounting Error Paradox', () => {
  const ACCOUNTING_ERROR: FinancialData = {
    business_name: 'Bad Books LLC', fiscal_year: '2024',
    revenue: 500_000,
    cogs: 600_000,
    gross_profit: 100_000,   // ← claimed, but math says −$100K
    operating_expenses: 80_000, owner_salary: 60_000,
    rent: null, marketing: null, ebitda: null, sde: null,
    yoy_growth: 0.05, employee_count: null, notes: null,
    industry: 'general', cash_on_hand: null,
  }
  const assumptions: Assumptions = { ...BASE_ASSUMPTIONS, owner_salary: 60_000, growth_rate: 0.05 }

  it('does not throw', () => {
    expect(() => computeHealthScore(ACCOUNTING_ERROR, assumptions)).not.toThrow()
  })

  it('uses CALCULATED gross_profit (−$100K), overrides the claimed $100K', () => {
    const { metrics } = computeHealthScore(ACCOUNTING_ERROR, assumptions)
    expect(metrics.gross_profit).toBeCloseTo(-100_000, 0)
  })

  it('gross_margin_pct is negative', () => {
    const { metrics } = computeHealthScore(ACCOUNTING_ERROR, assumptions)
    expect(metrics.gross_margin_pct).toBeLessThan(0)
  })

  it('expense_ratio is 1 (capped) because gross_profit <= 0', () => {
    const { metrics } = computeHealthScore(ACCOUNTING_ERROR, assumptions)
    expect(metrics.expense_ratio).toBe(1)
  })

  it('score is low but valid — not hallucinated high score', () => {
    const { score } = computeHealthScore(ACCOUNTING_ERROR, assumptions)
    expect(Number.isNaN(score)).toBe(false)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThan(40)   // a business losing money on COGS alone can't score well
  })

  it('no metric is NaN', () => {
    const { metrics } = computeHealthScore(ACCOUNTING_ERROR, assumptions)
    noNaN(metrics as unknown as Record<string, number>)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Case 3 — 100% Lifestyle Solopreneur
// Revenue = $200K, COGS = $0, Owner Salary = $200K, Other OpEx = $0
// Goal: SDE = $200K, EBITDA = $0, SDE invariant across all salary slider values.
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge Case 3 — 100% Lifestyle Solopreneur', () => {
  const SOLOPRENEUR: FinancialData = {
    business_name: 'Solo LLC', fiscal_year: '2024',
    revenue: 200_000, cogs: 0, gross_profit: 200_000,
    operating_expenses: 200_000,   // 100% is owner salary
    owner_salary: 200_000,
    rent: null, marketing: null, ebitda: null, sde: null,
    yoy_growth: 0.08, employee_count: 1, notes: null,
    industry: 'professional_services', cash_on_hand: null,
  }

  it('EBITDA = $0 at document salary', () => {
    const { metrics } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 200_000, growth_rate: 0.08 })
    expect(metrics.ebitda).toBeCloseTo(0, 0)
  })

  it('SDE = $200K at document salary', () => {
    const { metrics } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 200_000, growth_rate: 0.08 })
    expect(metrics.sde).toBeCloseTo(200_000, 0)
  })

  it('SDE stays $200K when slider drops to $100K', () => {
    const { metrics } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 100_000, growth_rate: 0.08 })
    expect(metrics.sde).toBeCloseTo(200_000, 0)
  })

  it('SDE stays $200K when slider drops to $0', () => {
    const { metrics } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 0, growth_rate: 0.08 })
    expect(metrics.sde).toBeCloseTo(200_000, 0)
  })

  it('SDE stays $200K when slider raises to $500K', () => {
    const { metrics } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 500_000, growth_rate: 0.08 })
    expect(metrics.sde).toBeCloseTo(200_000, 0)
  })

  it('score is valid and non-NaN', () => {
    const { score } = computeHealthScore(SOLOPRENEUR, { ...BASE_ASSUMPTIONS, owner_salary: 200_000, growth_rate: 0.08 })
    expect(Number.isNaN(score)).toBe(false)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge Case 4 — 9,900% Hyper-Growth (pivot / launch scenario)
// Revenue: $1M, Prior Year: $10K → YoY = 99.0 (9,900%)
// Goal: no NaN, growth score = 25/25 (above range), valid projected revenue.
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge Case 4 — 9,900% Hyper-Growth', () => {
  const HYPER: FinancialData = {
    business_name: 'Rocket Inc', fiscal_year: '2024',
    revenue: 1_000_000, cogs: 300_000, gross_profit: 700_000,
    operating_expenses: 400_000, owner_salary: 120_000,
    rent: null, marketing: null, ebitda: null, sde: null,
    yoy_growth: 99.0,   // 9,900% — far above any benchmark range
    employee_count: 8, notes: null,
    industry: 'saas', cash_on_hand: null,
  }
  const assumptions: Assumptions = { ...BASE_ASSUMPTIONS, owner_salary: 120_000, growth_rate: 99.0 }

  it('does not throw', () => {
    expect(() => computeHealthScore(HYPER, assumptions)).not.toThrow()
  })

  it('no metric is NaN or Infinite', () => {
    const { metrics } = computeHealthScore(HYPER, assumptions)
    noNaN(metrics as unknown as Record<string, number>)
  })

  it('growth score is full 25/25 — above every benchmark range', () => {
    const { breakdown } = computeHealthScore(HYPER, assumptions)
    expect(breakdown.growth_score).toBe(25)
  })

  it('score is between 0 and 100', () => {
    const { score } = computeHealthScore(HYPER, assumptions)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('projected_revenue is a finite number — not Infinity', () => {
    const { metrics } = computeHealthScore(HYPER, assumptions)
    // projected = 1M * (1 + 99) = $100M — huge but finite
    expect(Number.isFinite(metrics.projected_revenue)).toBe(true)
    expect(metrics.projected_revenue).toBeCloseTo(100_000_000, -3)
  })

  it('SDE invariant despite extreme growth rate', () => {
    const base   = computeHealthScore(HYPER, assumptions)
    const higher = computeHealthScore(HYPER, { ...assumptions, owner_salary: 400_000 })
    expect(higher.metrics.sde).toBeCloseTo(base.metrics.sde, 0)
  })
})
