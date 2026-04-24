import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCards } from '../../components/MetricCards'
import type { DerivedMetrics } from '../../types'

const METRICS: DerivedMetrics = {
  revenue: 1_840_000,
  cogs: 1_102_000,
  gross_profit: 738_000,
  gross_margin_pct: 0.4011,
  operating_expenses: 312_000,
  ebitda: 426_000,
  sde: 546_000,
  sde_ratio: 0.2967,
  yoy_growth: 0.14,
  expense_ratio: 0.4228,
  projected_revenue: 2_097_600,
  monthly_burn: 117_833,
}

function renderCards(industry: string | null = 'landscaping', hasGrowth = false) {
  return render(
    <MetricCards metrics={METRICS} hasGrowthAssumption={hasGrowth} industry={industry} />
  )
}

describe('MetricCards — card presence', () => {
  it('renders Revenue card', () => {
    renderCards()
    // exact match avoids collision with "covered by revenue" in Monthly Burn sub-line
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    // 1,840,000 >= 1M threshold → formats as $1.84M
    expect(screen.getByText('$1.84M')).toBeInTheDocument()
  })

  it('renders Gross Margin card', () => {
    renderCards()
    expect(screen.getByText(/Gross Margin/i)).toBeInTheDocument()
  })

  it('renders Owner SDE card', () => {
    renderCards()
    expect(screen.getByText(/Owner SDE/i)).toBeInTheDocument()
  })

  it('renders YoY Growth card', () => {
    renderCards()
    expect(screen.getByText(/YoY Growth/i)).toBeInTheDocument()
  })

  it('renders Expense Ratio card', () => {
    renderCards()
    expect(screen.getByText(/Expense Ratio/i)).toBeInTheDocument()
  })

  it('renders Monthly Burn card', () => {
    renderCards()
    expect(screen.getByText(/Monthly Burn/i)).toBeInTheDocument()
  })

  // Regression: EBITDA card was replaced by Monthly Burn
  it('does NOT render an EBITDA card', () => {
    renderCards()
    expect(screen.queryByText(/^EBITDA$/i)).not.toBeInTheDocument()
  })
})

describe('MetricCards — COGS and OpEx sub-lines', () => {
  // Regression: COGS sub-line added to Gross Margin card
  it('shows COGS on Gross Margin card', () => {
    renderCards()
    expect(screen.getByText(/COGS:/i)).toBeInTheDocument()
  })

  // Regression: OpEx sub-line added to Expense Ratio card
  it('shows OpEx dollar amount on Expense Ratio card', () => {
    renderCards()
    expect(screen.getByText(/OpEx:/i)).toBeInTheDocument()
  })
})

describe('MetricCards — projected revenue', () => {
  it('does not show projected revenue when growth assumption is zero', () => {
    renderCards('landscaping', false)
    expect(screen.queryByText(/Projected/i)).not.toBeInTheDocument()
  })

  it('shows projected revenue when growth assumption is non-zero', () => {
    renderCards('landscaping', true)
    expect(screen.getByText(/Projected/i)).toBeInTheDocument()
  })
})

describe('MetricCards — benchmark badges', () => {
  it('shows a benchmark badge on Gross Margin card', () => {
    renderCards('landscaping')
    // Multiple cards show badges — check at least one Landscaping avg badge is present
    expect(screen.getAllByText(/Landscaping avg/i).length).toBeGreaterThan(0)
  })

  it('shows "above" badge when metric exceeds industry high', () => {
    const aboveRange: DerivedMetrics = { ...METRICS, gross_margin_pct: 0.80 }
    render(<MetricCards metrics={aboveRange} hasGrowthAssumption={false} industry="landscaping" />)
    // Multiple cards may show "above" — at least one must be present
    expect(screen.getAllByText(/above Landscaping avg/i).length).toBeGreaterThan(0)
  })

  it('shows "below" badge when metric is under industry low', () => {
    const belowRange: DerivedMetrics = { ...METRICS, gross_margin_pct: 0.10 }
    render(<MetricCards metrics={belowRange} hasGrowthAssumption={false} industry="landscaping" />)
    expect(screen.getAllByText(/below Landscaping avg/i).length).toBeGreaterThan(0)
  })

  it('falls back to SMB Average label for null industry', () => {
    renderCards(null)
    expect(screen.getAllByText(/SMB Average/i).length).toBeGreaterThan(0)
  })
})
