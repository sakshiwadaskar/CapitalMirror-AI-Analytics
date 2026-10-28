// Mobile port of frontend/src/components/MetricCards.tsx.
// Web uses CSS Grid (`grid-cols-2 md:grid-cols-3`) — RN has no CSS Grid at
// all, only Flexbox. `flexWrap: 'wrap'` + fixed-percent-width children
// reproduces a 2-column grid here.

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { getBenchmark, vsRange, type BenchmarkResult } from '@/lib/benchmarks';
import type { DerivedMetrics } from '@/types';

interface Props {
  metrics: DerivedMetrics;
  hasGrowthAssumption: boolean;
  industry: string | null;
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number) {
  return `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function BenchmarkBadge({ result, label }: { result: BenchmarkResult; label: string }) {
  if (result === 'above') {
    return <Text style={[styles.badge, { color: '#4ade80' }]}>↑ above {label} avg</Text>;
  }
  if (result === 'below') {
    return <Text style={[styles.badge, { color: colors.red }]}>↓ below {label} avg</Text>;
  }
  return <Text style={[styles.badge, { color: colors.slateMuted }]}>≈ at {label} avg</Text>;
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  sub2?: string;
  highlight?: 'green' | 'yellow' | 'red';
  benchmark?: { result: BenchmarkResult; industryLabel: string };
}

const HIGHLIGHT_COLORS: Record<NonNullable<CardProps['highlight']>, string> = {
  green: '#4ade80',
  yellow: '#facc15',
  red: colors.red,
};

function Card({ label, value, sub, sub2, highlight, benchmark }: CardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: highlight ? HIGHLIGHT_COLORS[highlight] : '#ffffff' }]}>
        {value}
      </Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
      {sub2 && <Text style={styles.sub}>{sub2}</Text>}
      {benchmark && (
        <View style={styles.badgeWrap}>
          <BenchmarkBadge result={benchmark.result} label={benchmark.industryLabel} />
        </View>
      )}
    </View>
  );
}

export function MetricCards({ metrics, hasGrowthAssumption, industry }: Props) {
  const bm = getBenchmark(industry);
  const gmColor = metrics.gross_margin_pct >= 0.4 ? 'green' : metrics.gross_margin_pct >= 0.2 ? 'yellow' : 'red';
  const growthColor = metrics.yoy_growth >= 0.1 ? 'green' : metrics.yoy_growth >= 0 ? 'yellow' : 'red';

  return (
    <View style={styles.grid}>
      <Card
        label="Revenue"
        value={fmt(metrics.revenue)}
        sub={hasGrowthAssumption ? `Projected: ${fmt(metrics.projected_revenue)}` : undefined}
      />
      <Card
        label="Gross Margin"
        value={pct(metrics.gross_margin_pct)}
        sub={`Gross Profit: ${fmt(metrics.gross_profit)}`}
        sub2={`COGS: ${fmt(metrics.cogs)}`}
        highlight={gmColor}
        benchmark={{ result: vsRange(metrics.gross_margin_pct, bm.gross_margin), industryLabel: bm.label }}
      />
      <Card
        label="Owner SDE"
        value={fmt(metrics.sde)}
        sub={`${pct(metrics.sde_ratio)} of revenue`}
        benchmark={{ result: vsRange(metrics.sde_ratio, bm.sde_ratio), industryLabel: bm.label }}
      />
      <Card
        label="Monthly Costs"
        value={fmt(metrics.monthly_burn)}
        sub={`${(metrics.revenue / (metrics.cogs + metrics.operating_expenses)).toFixed(1)}× covered by revenue`}
      />
      <Card
        label="YoY Growth"
        value={pct(metrics.yoy_growth)}
        highlight={growthColor}
        benchmark={{ result: vsRange(metrics.yoy_growth, bm.yoy_growth), industryLabel: bm.label }}
      />
      <Card
        label="Expense Ratio"
        value={pct(metrics.expense_ratio)}
        sub={`OpEx: ${fmt(metrics.operating_expenses)}`}
        sub2="OpEx / Gross Profit"
        highlight={metrics.expense_ratio > 0.8 ? 'red' : metrics.expense_ratio > 0.6 ? 'yellow' : 'green'}
        benchmark={{ result: vsRange(metrics.expense_ratio, bm.expense_ratio), industryLabel: bm.label }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    // 2-column grid: each card takes ~48% so two fit per row with the gap
    // filling the rest. `flexBasis` + `flexGrow` is the RN equivalent of a
    // CSS grid track.
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 2,
    borderTopColor: colors.maroon,
    backgroundColor: colors.card,
    padding: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.slateMuted,
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    fontSize: 11,
    color: colors.slateMuted,
    marginTop: 3,
  },
  badge: {
    fontSize: 11,
    fontWeight: '500',
  },
  badgeWrap: {
    marginTop: 6,
  },
});
