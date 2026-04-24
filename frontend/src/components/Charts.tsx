import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DerivedMetrics } from '../types'

interface Props {
  metrics: DerivedMetrics
}

const COLORS = ['#b5605a', '#52130c', '#22c55e', '#eab308']

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const customTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-700 text-white text-xs px-3 py-2 rounded shadow">
        <p className="font-semibold">{payload[0].name}</p>
        <p>{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export function Charts({ metrics }: Props) {
  const waterfallData = [
    { name: 'Revenue', value: metrics.revenue },
    { name: 'COGS', value: metrics.cogs },
    { name: 'Gross Profit', value: metrics.gross_profit },
    { name: 'OpEx', value: metrics.operating_expenses },
    { name: 'EBITDA', value: metrics.ebitda },
    { name: 'Owner SDE', value: metrics.sde },
  ]

  return (
    <div className="group rounded-xl p-6 border border-t-2 transition-colors"
      style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', borderTopColor: 'var(--ct-maroon)' }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4 text-slate-500 group-hover:text-red-800 transition-colors">P&L Breakdown</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={waterfallData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={customTooltip as never} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {waterfallData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
