import { useState, useEffect, useRef, useMemo } from 'react'
import type { FinancialData, Assumptions, HealthScore, BusinessInsights } from '../types'
import { computeHealthScore } from '../lib/scoring'
import { fetchRationale } from '../lib/api'

const EMPTY_INSIGHTS: BusinessInsights = { whats_working: [], whats_not: [], fix_first: [] }

export function useHealthScore(data: FinancialData | null, assumptions: Assumptions) {
  const [rationale, setRationale] = useState<string>('')
  const [insights, setInsights] = useState<BusinessInsights>(EMPTY_INSIGHTS)
  const [rationaleLoading, setRationaleLoading] = useState(false)
  const [rationaleError, setRationaleError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const healthScore = useMemo<HealthScore | null>(
    () => (data ? computeHealthScore(data, assumptions) : null),
    [data, assumptions]
  )

  useEffect(() => {
    if (!data || !healthScore) {
      setRationale('')
      setInsights(EMPTY_INSIGHTS)
      setRationaleError(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()
      setRationaleLoading(true)
      setRationaleError(false)
      try {
        const { rationale: r, insights: i } = await fetchRationale(
          data, assumptions, healthScore.score, abortRef.current.signal
        )
        setRationale(r)
        setInsights(i)
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[rationale]', err)
        setRationale('')
        setInsights(EMPTY_INSIGHTS)
        setRationaleError(true)
      } finally {
        setRationaleLoading(false)
      }
    }, 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [data, assumptions])

  return { healthScore, rationale, insights, rationaleLoading, rationaleError }
}
