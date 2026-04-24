export interface FinancialData {
  business_name: string | null
  fiscal_year: string | null
  revenue: number | null
  cogs: number | null
  gross_profit: number | null
  operating_expenses: number | null
  owner_salary: number | null
  rent: number | null
  marketing: number | null
  ebitda: number | null
  sde: number | null
  yoy_growth: number | null
  employee_count: number | null
  cash_on_hand: number | null
  notes: string | null
  industry: string | null
}

export interface Assumptions {
  owner_salary: number
  growth_rate: number     // decimal, e.g. 0.14
  cogs_adjustment: number // decimal, e.g. 0.05 = 5% higher COGS
  opex_adjustment: number // decimal
}

export interface DerivedMetrics {
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number
  operating_expenses: number
  ebitda: number
  sde: number
  sde_ratio: number
  yoy_growth: number
  expense_ratio: number
  projected_revenue: number
  monthly_burn: number
}

export interface ScoreBreakdown {
  gross_margin_score: number
  sde_ratio_score: number
  growth_score: number
  expense_score: number
  total: number
}

export interface HealthScore {
  score: number
  breakdown: ScoreBreakdown
  metrics: DerivedMetrics
}

export interface BusinessInsights {
  whats_working: string[]
  whats_not: string[]
  fix_first: string[]
}
