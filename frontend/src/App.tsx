import { useState } from 'react'
import type { FinancialData, Assumptions } from './types'
import { InputArea } from './components/InputArea'
import { Dashboard } from './components/Dashboard'
import { useHealthScore } from './hooks/useHealthScore'

function defaultAssumptions(data: FinancialData | null): Assumptions {
  return {
    owner_salary: data?.owner_salary ?? 0,
    growth_rate: data?.yoy_growth ?? 0,
    cogs_adjustment: 0,
    opex_adjustment: 0,
  }
}

export default function App() {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [assumptions, setAssumptions] = useState<Assumptions>(defaultAssumptions(null))

  function handleParsed(data: FinancialData) {
    setFinancialData(data)
    setAssumptions(defaultAssumptions(data))
  }

  function handleReset() {
    setFinancialData(null)
    setAssumptions(defaultAssumptions(null))
  }

  const { healthScore, rationale, insights, rationaleLoading, rationaleError } = useHealthScore(financialData, assumptions)

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: '#000000' }}>
      {!financialData || !healthScore ? (
        <div className="min-h-screen flex items-center justify-center">
          <InputArea onParsed={handleParsed} />
        </div>
      ) : (
        <Dashboard
          data={financialData}
          assumptions={assumptions}
          onAssumptionsChange={setAssumptions}
          healthScore={healthScore}
          rationale={rationale}
          insights={insights}
          rationaleLoading={rationaleLoading}
          rationaleError={rationaleError}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
