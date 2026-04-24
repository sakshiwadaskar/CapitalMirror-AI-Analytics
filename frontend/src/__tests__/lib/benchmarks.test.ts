import { describe, it, expect } from 'vitest'
import { getBenchmark, vsRange } from '../../lib/benchmarks'

describe('getBenchmark', () => {
  it('returns correct label for known industries', () => {
    expect(getBenchmark('landscaping').label).toBe('Landscaping')
    expect(getBenchmark('saas').label).toBe('SaaS')
    expect(getBenchmark('restaurant').label).toBe('Restaurant')
    expect(getBenchmark('professional_services').label).toBe('Professional Services')
  })

  it('falls back to SMB Average for unknown industry', () => {
    expect(getBenchmark('plumbing').label).toBe('SMB Average')
    expect(getBenchmark('').label).toBe('SMB Average')
    expect(getBenchmark('xyz_unknown').label).toBe('SMB Average')
  })

  it('falls back to SMB Average for null industry', () => {
    expect(getBenchmark(null).label).toBe('SMB Average')
  })

  it('normalises whitespace in industry key', () => {
    // Claude might return "professional services" with a space
    expect(getBenchmark('professional services').label).toBe('Professional Services')
  })

  it('all industries have four benchmark fields', () => {
    const industries = ['landscaping', 'restaurant', 'saas', 'retail', 'construction', 'professional_services', 'ecommerce', 'healthcare', 'manufacturing', 'general']
    for (const ind of industries) {
      const bm = getBenchmark(ind)
      expect(bm.gross_margin).toHaveLength(2)
      expect(bm.sde_ratio).toHaveLength(2)
      expect(bm.yoy_growth).toHaveLength(2)
      expect(bm.expense_ratio).toHaveLength(2)
    }
  })

  it('all ranges have low < high', () => {
    const industries = ['landscaping', 'restaurant', 'saas', 'retail', 'construction', 'professional_services', 'ecommerce', 'healthcare', 'manufacturing', 'general']
    for (const ind of industries) {
      const bm = getBenchmark(ind)
      for (const field of ['gross_margin', 'sde_ratio', 'yoy_growth', 'expense_ratio'] as const) {
        expect(bm[field][0]).toBeLessThan(bm[field][1])
      }
    }
  })

  it('SaaS gross margin range is higher than restaurant', () => {
    const saas = getBenchmark('saas')
    const restaurant = getBenchmark('restaurant')
    expect(saas.gross_margin[0]).toBeGreaterThan(restaurant.gross_margin[1])
  })
})

describe('vsRange', () => {
  it('returns above when value exceeds high', () => {
    expect(vsRange(0.55, [0.35, 0.50])).toBe('above')
  })

  it('returns below when value is less than low', () => {
    expect(vsRange(0.20, [0.35, 0.50])).toBe('below')
  })

  it('returns average when value is within range', () => {
    expect(vsRange(0.42, [0.35, 0.50])).toBe('average')
    expect(vsRange(0.35, [0.35, 0.50])).toBe('average') // inclusive low
    expect(vsRange(0.50, [0.35, 0.50])).toBe('average') // inclusive high
  })

  it('handles edge: value exactly at boundaries', () => {
    expect(vsRange(0.35, [0.35, 0.50])).toBe('average')
    expect(vsRange(0.50, [0.35, 0.50])).toBe('average')
    // just outside
    expect(vsRange(0.3499, [0.35, 0.50])).toBe('below')
    expect(vsRange(0.5001, [0.35, 0.50])).toBe('above')
  })
})
