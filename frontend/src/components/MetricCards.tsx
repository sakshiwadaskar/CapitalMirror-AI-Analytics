import type { DerivedMetrics } from '../types'
import { getBenchmark, vsRange, type BenchmarkResult } from '../lib/benchmarks'

interface Props {
  metrics: DerivedMetrics
  hasGrowthAssumption: boolean
  industry: string | null
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function pct(n: number) {
  return `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`
}

function BenchmarkBadge({ result, label }: { result: BenchmarkResult; label: string }) {
  if (result === 'above') return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: '#4ade80' }}>
      ↑ above {label} avg
    </span>
  )
  if (result === 'below') return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: '#b5605a' }}>
      ↓ below {label} avg
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500">
      ≈ at {label} avg
    </span>
  )
}

interface CardProps {
  label: string
  value: string
  sub?: string
  sub2?: string
  highlight?: 'green' | 'yellow' | 'red'
  benchmark?: { result: BenchmarkResult; industryLabel: string }
}

function Card({ label, value, sub, sub2, highlight, benchmark }: CardProps) {
  const colors = { green: 'text-green-400', yellow: 'text-yellow-400', red: '#b5605a' }
  return (
    <div
      className="group rounded-xl p-4 border border-t-2 transition-colors"
      style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', borderTopColor: 'var(--ct-maroon)' }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-2 text-slate-500 group-hover:text-red-900 transition-colors">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${highlight ? (highlight === 'red' ? '' : colors[highlight]) : 'text-white'}`}
        style={highlight === 'red' ? { color: colors.red } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
      {sub2 && <div className="text-slate-500 text-xs mt-0.5">{sub2}</div>}
      {benchmark && (
        <div className="mt-1.5">
          <BenchmarkBadge result={benchmark.result} label={benchmark.industryLabel} />
        </div>
      )}
    </div>
  )
}

export function MetricCards({ metrics, hasGrowthAssumption, industry }: Props) {
  const bm = getBenchmark(industry)
  const gmColor  = metrics.gross_margin_pct >= 0.4 ? 'green' : metrics.gross_margin_pct >= 0.2 ? 'yellow' : 'red'
  const growthColor = metrics.yoy_growth >= 0.1 ? 'green' : metrics.yoy_growth >= 0 ? 'yellow' : 'red'

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <Card
        label="Revenue"
        value={fmt(metrics.revenue)}
        sub={hasGrowthAssumption ? `Projected: ${fmt(metrics.projected_revenue)}` : undefined}
      />
      <Card
        label="Gross Margin"
        value={pct(metrics.gross_margin_pct)}
        sub={`Gross Profit: ${fmt(metrics.gross_profit)}`}
        sub2={`COGS: ${fmt(metrics.cogs)}`}
        highlight={gmColor}
        benchmark={{ result: vsRange(metrics.gross_margin_pct, bm.gross_margin), industryLabel: bm.label }}
      />
      <Card
        label="Owner SDE"
        value={fmt(metrics.sde)}
        sub={`${pct(metrics.sde_ratio)} of revenue`}
        benchmark={{ result: vsRange(metrics.sde_ratio, bm.sde_ratio), industryLabel: bm.label }}
      />
      <Card
        label="Monthly Burn"
        value={fmt(metrics.monthly_burn)}
        sub={`${(metrics.revenue / (metrics.cogs + metrics.operating_expenses)).toFixed(1)}× covered by revenue`}
      />
      <Card
        label="YoY Growth"
        value={pct(metrics.yoy_growth)}
        highlight={growthColor}
        benchmark={{ result: vsRange(metrics.yoy_growth, bm.yoy_growth), industryLabel: bm.label }}
      />
      <Card
        label="Expense Ratio"
        value={pct(metrics.expense_ratio)}
        sub={`OpEx: ${fmt(metrics.operating_expenses)}`}
        sub2="OpEx / Gross Profit"
        highlight={metrics.expense_ratio > 0.8 ? 'red' : metrics.expense_ratio > 0.6 ? 'yellow' : 'green'}
        benchmark={{ result: vsRange(metrics.expense_ratio, bm.expense_ratio), industryLabel: bm.label }}
      />
    </div>
  )
}
