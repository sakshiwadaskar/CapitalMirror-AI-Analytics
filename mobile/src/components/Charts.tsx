// Mobile port of frontend/src/components/Charts.tsx.
// Recharts (SVG+DOM) doesn't run in React Native. Rather than pull in a
// full RN charting library for a single 6-bar waterfall, this draws bars
// as plain Views whose height is a percentage of the tallest value —
// simple Flexbox math, no extra dependency.

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import type { DerivedMetrics } from '@/types';

interface Props {
  metrics: DerivedMetrics;
}

const BAR_COLORS = [colors.red, colors.leather, '#22c55e', '#eab308', colors.red, colors.leather];
const CHART_HEIGHT = 160;

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function Charts({ metrics }: Props) {
  const data = [
    { name: 'Revenue', value: metrics.revenue },
    { name: 'COGS', value: metrics.cogs },
    { name: 'Gross Profit', value: metrics.gross_profit },
    { name: 'OpEx', value: metrics.operating_expenses },
    { name: 'EBITDA', value: metrics.ebitda },
    { name: 'Owner SDE', value: metrics.sde },
  ];

  // All bar heights are relative to the largest value in the set — same
  // idea as Recharts' auto-scaled Y axis, just computed by hand.
  const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>P&L Breakdown</Text>
      <View style={styles.chart}>
        {data.map((d, i) => {
          const barHeight = Math.max(4, (Math.abs(d.value) / maxValue) * CHART_HEIGHT);
          return (
            <View key={d.name} style={styles.column}>
              <Text style={styles.valueLabel}>{fmt(d.value)}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
                  ]}
                />
              </View>
              <Text style={styles.nameLabel}>{d.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 2,
    borderTopColor: colors.maroon,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.slateMuted,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  valueLabel: {
    fontSize: 9,
    color: colors.slateMuted,
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  nameLabel: {
    fontSize: 9,
    color: colors.slateMuted,
    textAlign: 'center',
  },
});
