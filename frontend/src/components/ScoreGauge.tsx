import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import type { HealthScore } from '../types'

interface Props {
  healthScore: HealthScore
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
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#eab308'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

export function ScoreGauge({ healthScore, rationale, rationaleLoading }: Props) {
  const data = [{ value: healthScore.score, fill: 'var(--ct-red)' }]

  return (
    <div
      className="group rounded-xl p-6 border flex flex-col items-center transition-colors"
      style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', borderTopWidth: 2, borderTopColor: 'var(--ct-maroon)' }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest mb-2 text-slate-500 group-hover:text-red-800 transition-colors">
        Health Score
      </div>

      <div className="relative">
        <RadialBarChart
          width={180} height={180} cx={90} cy={90}
          innerRadius={60} outerRadius={85} barSize={16}
          data={data} startAngle={90} endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#1a1714' }} dataKey="value" angleAxisId={0} cornerRadius={8} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{healthScore.score}</span>
          <span className="text-xs font-semibold mt-0.5" style={{ color: scoreLabelColor(healthScore.score) }}>
            {scoreLabel(healthScore.score)}
          </span>
        </div>
      </div>

      <div className="w-full mt-4 space-y-1.5">
        {[
          { label: 'Gross Margin',      val: healthScore.breakdown.gross_margin_score, max: 30 },
          { label: 'SDE Ratio',         val: healthScore.breakdown.sde_ratio_score,    max: 25 },
          { label: 'YoY Growth',        val: healthScore.breakdown.growth_score,        max: 25 },
          { label: 'Expense Efficiency',val: healthScore.breakdown.expense_score,       max: 20 },
        ].map(({ label, val, max }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 w-32 shrink-0">{label}</span>
            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: '#1a1714' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${(val / max) * 100}%`, backgroundColor: 'var(--ct-red)' }} />
            </div>
            <span className="text-slate-300 w-10 text-right">{val}/{max}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 w-full">
        {rationaleLoading
          ? <p className="text-slate-500 text-sm italic">Generating analysis...</p>
          : rationale
            ? <p className="text-slate-300 text-sm leading-relaxed">{rationale}</p>
            : null}
      </div>
    </div>
  )
}
