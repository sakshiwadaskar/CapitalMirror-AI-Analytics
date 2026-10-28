export interface Benchmark {
  label: string
  gross_margin: [number, number]   // [low, high] as decimals — COGS includes direct labor for service businesses
  sde_ratio:    [number, number]   // SDE / Revenue
  yoy_growth:   [number, number]   // decimal
  expense_ratio:[number, number]   // OpEx / Gross Profit
}

const BENCHMARKS: Record<string, Benchmark> = {
  // Gross margin assumes COGS = labor + materials (direct costs), consistent with SMB P&L conventions
  landscaping:           { label: 'Landscaping',           gross_margin: [0.35, 0.50], sde_ratio: [0.18, 0.32], yoy_growth: [0.04, 0.15], expense_ratio: [0.38, 0.58] },
  restaurant:            { label: 'Restaurant',            gross_margin: [0.30, 0.50], sde_ratio: [0.08, 0.18], yoy_growth: [0.02, 0.08], expense_ratio: [0.58, 0.82] },
  saas:                  { label: 'SaaS',                  gross_margin: [0.65, 0.82], sde_ratio: [0.15, 0.35], yoy_growth: [0.20, 0.60], expense_ratio: [0.30, 0.55] },
  retail:                { label: 'Retail',                gross_margin: [0.35, 0.55], sde_ratio: [0.10, 0.22], yoy_growth: [0.02, 0.08], expense_ratio: [0.50, 0.70] },
  construction:          { label: 'Construction',          gross_margin: [0.15, 0.30], sde_ratio: [0.10, 0.22], yoy_growth: [0.04, 0.12], expense_ratio: [0.50, 0.72] },
  professional_services: { label: 'Professional Services', gross_margin: [0.50, 0.72], sde_ratio: [0.25, 0.45], yoy_growth: [0.08, 0.22], expense_ratio: [0.25, 0.45] },
  ecommerce:             { label: 'E-commerce',            gross_margin: [0.28, 0.50], sde_ratio: [0.08, 0.20], yoy_growth: [0.12, 0.35], expense_ratio: [0.38, 0.60] },
  healthcare:            { label: 'Healthcare',            gross_margin: [0.38, 0.55], sde_ratio: [0.18, 0.38], yoy_growth: [0.04, 0.12], expense_ratio: [0.40, 0.62] },
  manufacturing:         { label: 'Manufacturing',         gross_margin: [0.20, 0.40], sde_ratio: [0.12, 0.26], yoy_growth: [0.03, 0.10], expense_ratio: [0.45, 0.65] },
  general:               { label: 'SMB Average',           gross_margin: [0.30, 0.52], sde_ratio: [0.14, 0.28], yoy_growth: [0.04, 0.14], expense_ratio: [0.45, 0.65] },
}

export function getBenchmark(industry: string | null): Benchmark {
  const key = (industry ?? '').toLowerCase().replace(/\s+/g, '_')
  return BENCHMARKS[key] ?? BENCHMARKS['general']
}

export type BenchmarkResult = 'above' | 'average' | 'below'

export function vsRange(value: number, range: [number, number]): BenchmarkResult {
  if (value > range[1]) return 'above'
  if (value < range[0]) return 'below'
  return 'average'
}
