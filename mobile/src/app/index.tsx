// Mobile port of frontend/src/App.tsx's top-level state-swap pattern: one
// screen, no navigation — show InputArea until data is parsed, then swap to
// the dashboard view. (AssumptionsPanel's sliders aren't ported yet, so
// assumptions are fixed to the document's own values for now.)

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Charts } from '@/components/Charts';
import { InputArea } from '@/components/InputArea';
import { MetricCards } from '@/components/MetricCards';
import { ScoreGauge } from '@/components/ScoreGauge';
import { colors } from '@/constants/colors';
import { useHealthScore } from '@/hooks/useHealthScore';
import type { Assumptions, FinancialData } from '@/types';

function defaultAssumptions(data: FinancialData | null): Assumptions {
  return {
    owner_salary: data?.owner_salary ?? 0,
    growth_rate: data?.yoy_growth ?? 0,
    cogs_adjustment: 0,
    opex_adjustment: 0,
  };
}

export default function HomeScreen() {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions>(defaultAssumptions(null));

  function handleParsed(data: FinancialData) {
    setFinancialData(data);
    setAssumptions(defaultAssumptions(data));
  }

  function handleReset() {
    setFinancialData(null);
    setAssumptions(defaultAssumptions(null));
  }

  const { healthScore, rationale, rationaleLoading } = useHealthScore(financialData, assumptions);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!financialData || !healthScore ? (
          <InputArea onParsed={handleParsed} />
        ) : (
          <View style={styles.dashboard}>
            <Pressable onPress={handleReset}>
              <Text style={styles.resetLink}>← Start over</Text>
            </Pressable>
            <ScoreGauge healthScore={healthScore} rationale={rationale} rationaleLoading={rationaleLoading} />
            <MetricCards
              metrics={healthScore.metrics}
              hasGrowthAssumption={assumptions.growth_rate !== 0}
              industry={financialData.industry}
            />
            <Charts metrics={healthScore.metrics} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 20,
    paddingTop: 12,
    gap: 16,
  },
  dashboard: {
    gap: 16,
  },
  resetLink: {
    color: colors.slateMuted,
    fontSize: 13,
  },
});
