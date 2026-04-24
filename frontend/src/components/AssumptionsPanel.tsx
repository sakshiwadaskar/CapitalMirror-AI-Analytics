import type { Assumptions } from '../types'

interface Props {
  assumptions: Assumptions
  onChange: (a: Assumptions) => void
}

interface SliderProps {
  label: string
  sub?: string
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
          {sub && <span className="text-slate-500 text-xs ml-2">{sub}</span>}
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ct-red)' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 cursor-pointer" style={{ accentColor: 'var(--ct-red)' } as React.CSSProperties}
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
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(0)}%`
}

export function AssumptionsPanel({ assumptions, onChange }: Props) {
  function set<K extends keyof Assumptions>(key: K, value: Assumptions[K]) {
    onChange({ ...assumptions, [key]: value })
  }

  return (
    <div className="group rounded-xl p-6 border border-t-2 transition-colors"
      style={{ backgroundColor: 'var(--ct-card)', borderColor: 'var(--ct-border)', borderTopColor: 'var(--ct-maroon)' }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-5 text-slate-500 group-hover:text-red-800 transition-colors">Adjust Assumptions</div>

      <div className="space-y-5">
        <SliderRow
          label="Owner Salary"
          sub="affects SDE"
          value={assumptions.owner_salary}
          min={0}
          max={500_000}
          step={5_000}
          format={fmtDollar}
          onChange={v => set('owner_salary', v)}
        />
        <SliderRow
          label="YoY Growth Rate"
          sub="projected"
          value={assumptions.growth_rate}
          min={-0.30}
          max={0.60}
          step={0.01}
          format={fmtPct}
          onChange={v => set('growth_rate', v)}
        />
        <SliderRow
          label="COGS Adjustment"
          sub="± % of base COGS"
          value={assumptions.cogs_adjustment}
          min={-0.30}
          max={0.30}
          step={0.01}
          format={fmtPct}
          onChange={v => set('cogs_adjustment', v)}
        />
        <SliderRow
          label="OpEx Adjustment"
          sub="± % of base OpEx"
          value={assumptions.opex_adjustment}
          min={-0.30}
          max={0.30}
          step={0.01}
          format={fmtPct}
          onChange={v => set('opex_adjustment', v)}
        />
      </div>
    </div>
  )
}
