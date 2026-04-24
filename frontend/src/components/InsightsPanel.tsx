import type { BusinessInsights } from '../types'

interface Props {
  insights: BusinessInsights
  loading: boolean
  error?: boolean
}

interface CardProps {
  title: string
  points: string[]
  accentColor: string
}

function InsightCard({ title, points, accentColor }: CardProps) {
  return (
    <div
      className="group rounded-xl p-5 border flex-1 border-l-4"
      style={{
        backgroundColor: 'var(--ct-card)',
        borderColor: 'var(--ct-border)',
        borderLeftColor: accentColor,
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-3 transition-colors group-hover:text-red-800"
        style={{ color: accentColor }}
      >
        {title}
      </div>
      {points.length === 0 ? (
        <p className="text-slate-600 text-sm italic">No data</p>
      ) : (
        <ul className="space-y-2">
          {points.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300 leading-snug">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function InsightsPanel({ insights, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex gap-4">
        {["What's Working", "What's Not", 'Fix First'].map(title => (
          <div
            key={title}
            className="flex-1 rounded-xl p-5 border animate-pulse"
            style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)' }}
          >
            <div className="h-2.5 rounded w-20 mb-4" style={{ backgroundColor: 'var(--ct-border)' }} />
            <div className="space-y-2">
              <div className="h-2.5 rounded w-full" style={{ backgroundColor: 'var(--ct-border)' }} />
              <div className="h-2.5 rounded w-4/5" style={{ backgroundColor: 'var(--ct-border)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-4 border text-sm"
        style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', color: '#f97316' }}
      >
        Analysis unavailable — could not reach the AI service. Score and metrics are still accurate.
      </div>
    )
  }

  const hasAny =
    insights.whats_working.length > 0 ||
    insights.whats_not.length > 0 ||
    insights.fix_first.length > 0

  if (!hasAny) return null

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <InsightCard title="What's Working" points={insights.whats_working} accentColor="#4ade80" />
      <InsightCard title="What's Not"     points={insights.whats_not}     accentColor="#fbbf24" />
      <InsightCard title="Fix First"      points={insights.fix_first}     accentColor="#b5605a" />
    </div>
  )
}
