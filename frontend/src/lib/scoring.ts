import type { FinancialData, Assumptions, DerivedMetrics, ScoreBreakdown, HealthScore } from '../types'
import { getBenchmark } from './benchmarks'

// Score a metric relative to its industry benchmark range using smooth interpolation:
//   above range        → full marks (industry-leading)
//   within [low, high] → 70–100% of max (linearly interpolated)
//   below range        → 0–70% of max (linearly interpolated, floors at 0)
// lowerIsBetter=true inverts the direction (used for expense_ratio).
function scoreRelative(
  value: number,
  [low, high]: [number, number],
  maxPts: number,
  lowerIsBetter = false
): number {
  const spread = high - low
  if (lowerIsBetter) {
    if (value <= low) return maxPts
    if (value <= high) return maxPts * (1 - 0.3 * (value - low) / spread)
    return Math.max(0, maxPts * 0.7 * (1 - (value - high) / spread))
  } else {
    if (value >= high) return maxPts
    if (value >= low) return maxPts * (0.7 + 0.3 * (value - low) / spread)
    return Math.max(0, maxPts * 0.7 * (1 - (low - value) / spread))
  }
}

export function computeHealthScore(data: FinancialData, assumptions: Assumptions): HealthScore {
  const revenue = data.revenue ?? 0
  const baseCogs = data.cogs ?? (revenue - (data.gross_profit ?? 0))
  const cogs = baseCogs * (1 + assumptions.cogs_adjustment)
  const gross_profit = revenue - cogs
  const gross_margin_pct = revenue > 0 ? gross_profit / revenue : 0

  // Strip the document salary out of OpEx so the slider can swap in the assumed salary.
  // This preserves the identity: SDE = gross_profit − non-salary OpEx (invariant to salary label).
  const documentSalary = data.owner_salary ?? 0
  const baseNonSalaryOpex = (data.operating_expenses ?? 0) - documentSalary
  const nonSalaryOpex = baseNonSalaryOpex * (1 + assumptions.opex_adjustment)
  const operating_expenses = nonSalaryOpex + assumptions.owner_salary
  const expense_ratio = gross_profit > 0 ? operating_expenses / gross_profit : 1

  const ebitda = gross_profit - operating_expenses
  const sde = ebitda + assumptions.owner_salary
  const sde_ratio = revenue > 0 ? sde / revenue : 0

  const yoy_growth = assumptions.growth_rate
  const projected_revenue = revenue * (1 + yoy_growth)

  const monthly_burn = (cogs + operating_expenses) / 12

  const metrics: DerivedMetrics = {
    revenue,
    cogs,
    gross_profit,
    gross_margin_pct,
    operating_expenses,
    ebitda,
    sde,
    sde_ratio,
    yoy_growth,
    expense_ratio,
    projected_revenue,
    monthly_burn,
  }

  const bm = getBenchmark(data.industry)

  const breakdown: ScoreBreakdown = {
    gross_margin_score: Math.round(scoreRelative(gross_margin_pct, bm.gross_margin, 30)),
    sde_ratio_score:    Math.round(scoreRelative(sde_ratio,        bm.sde_ratio,    25)),
    growth_score:       Math.round(scoreRelative(yoy_growth,       bm.yoy_growth,   25)),
    expense_score:      Math.round(scoreRelative(expense_ratio,    bm.expense_ratio, 20, true)),
    total: 0,
  }
  breakdown.total = Math.round(
    breakdown.gross_margin_score +
    breakdown.sde_ratio_score +
    breakdown.growth_score +
    breakdown.expense_score
  )

  return { score: breakdown.total, breakdown, metrics }
}
