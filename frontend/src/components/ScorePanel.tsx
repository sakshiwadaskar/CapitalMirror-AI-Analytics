import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import type { HealthScore, Assumptions } from '../types'

interface Props {
  healthScore: HealthScore
  assumptions: Assumptions
  onAssumptionsChange: (a: Assumptions) => void
  rationale: string
  rationaleLoading: boolean
}

function scoreLabel(score: number) {
  if (score >= 75) return 'Strong'
  if (score >= 50) return 'Moderate'
  if (score >= 25) return 'At Risk'
  return 'Critical'
}

function scoreLabelColor(score: number) {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  if (score >= 25) return '#f97316'
  return '#b5605a'
}

interface SliderProps {
  label: string
  sub: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

function SliderRow({ label, sub, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <div>
          <span className="text-slate-200 text-sm font-medium">{label}</span>
          <span className="text-slate-500 text-xs ml-2">{sub}</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ct-red)' }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 cursor-pointer"
        style={{ accentColor: 'var(--ct-red)' } as React.CSSProperties}
      />
    </div>
  )
}

function fmtDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtPct(v: number) {
  return `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`
}

export function ScorePanel({ healthScore, assumptions, onAssumptionsChange, rationale, rationaleLoading }: Props) {
  function set<K extends keyof Assumptions>(key: K, value: Assumptions[K]) {
    onAssumptionsChange({ ...assumptions, [key]: value })
  }

  const data = [{ value: healthScore.score, fill: 'var(--ct-red)' }]
  const salaryMax = Math.ceil(Math.max(healthScore.metrics.revenue * 0.5, 500_000) / 10_000) * 10_000

  return (
    <div
      className="rounded-2xl border border-t-2 overflow-hidden"
      style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', borderTopColor: 'var(--ct-maroon)' }}
    >
      {/* ── Score section ── */}
      <div className="px-6 pt-6 pb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Health Score
        </div>

        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <RadialBarChart
              width={120} height={120} cx={60} cy={60}
              innerRadius={40} outerRadius={56} barSize={11}
              data={data} startAngle={90} endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: '#1a1714' }} dataKey="value" angleAxisId={0} cornerRadius={6} />
            </RadialBarChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white leading-none">{healthScore.score}</span>
              <span className="text-xs font-semibold mt-0.5" style={{ color: scoreLabelColor(healthScore.score) }}>
                {scoreLabel(healthScore.score)}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {[
              { label: 'Gross Margin',       val: healthScore.breakdown.gross_margin_score, max: 30 },
              { label: 'SDE Ratio',          val: healthScore.breakdown.sde_ratio_score,    max: 25 },
              { label: 'YoY Growth',         val: healthScore.breakdown.growth_score,       max: 25 },
              { label: 'Expense Efficiency', val: healthScore.breakdown.expense_score,      max: 20 },
            ].map(({ label, val, max }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                  <span>{label}</span>
                  <span className="tabular-nums">{val}/{max}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: '#1a1714' }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(val / max) * 100}%`, backgroundColor: 'var(--ct-red)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--ct-border)' }} />

      {/* ── Assumptions section ── */}
      <div className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          Adjust Assumptions
          <span className="ml-2 normal-case font-normal text-slate-600">— score updates live</span>
        </div>

        <div className="space-y-4">
          <SliderRow
            label="Owner Salary" sub="affects EBITDA, SDE stays fixed"
            value={assumptions.owner_salary} min={0} max={salaryMax} step={5_000}
            format={fmtDollar} onChange={v => set('owner_salary', v)}
          />
          <SliderRow
            label="YoY Growth" sub="projected"
            value={assumptions.growth_rate} min={-0.50} max={1.00} step={0.01}
            format={fmtPct} onChange={v => set('growth_rate', v)}
          />
          <SliderRow
            label="COGS Adjustment" sub="± % of base"
            value={assumptions.cogs_adjustment} min={-0.50} max={0.50} step={0.01}
            format={fmtPct} onChange={v => set('cogs_adjustment', v)}
          />
          <SliderRow
            label="OpEx Adjustment" sub="± % of base"
            value={assumptions.opex_adjustment} min={-0.50} max={0.50} step={0.01}
            format={fmtPct} onChange={v => set('opex_adjustment', v)}
          />
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--ct-border)' }} />

      {/* ── Rationale section ── */}
      <div className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Analysis
        </div>
        {rationaleLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-2.5 rounded w-full" style={{ backgroundColor: 'var(--ct-border)' }} />
            <div className="h-2.5 rounded w-5/6" style={{ backgroundColor: 'var(--ct-border)' }} />
            <div className="h-2.5 rounded w-4/6" style={{ backgroundColor: 'var(--ct-border)' }} />
          </div>
        ) : rationale ? (
          <p className="text-slate-300 text-sm leading-relaxed">{rationale}</p>
        ) : (
          <p className="text-slate-600 text-sm italic">Analysis will appear here.</p>
        )}
      </div>
    </div>
  )
}
