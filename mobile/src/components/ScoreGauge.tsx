// Mobile port of frontend/src/components/ScoreGauge.tsx.
// Recharts' <RadialBarChart> only runs on the web (it renders to an SVG via
// the browser DOM). React Native has no DOM, so we draw the ring ourselves
// with react-native-svg — the same underlying idea (an SVG <circle> whose
// stroke is partially dashed to look like a progress arc), just without a
// charting library doing it for us.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/colors';
import type { HealthScore } from '@/types';

interface Props {
  healthScore: HealthScore;
  rationale: string;
  rationaleLoading: boolean;
}

const SIZE = 180;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreLabel(score: number) {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'At Risk';
  return 'Critical';
}

function scoreLabelColor(score: number) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#f97316';
  return '#ef4444';
}

const BREAKDOWN_ROWS = (healthScore: HealthScore) => [
  { label: 'Gross Margin', val: healthScore.breakdown.gross_margin_score, max: 30 },
  { label: 'SDE Ratio', val: healthScore.breakdown.sde_ratio_score, max: 25 },
  { label: 'YoY Growth', val: healthScore.breakdown.growth_score, max: 25 },
  { label: 'Expense Efficiency', val: healthScore.breakdown.expense_score, max: 20 },
];

export function ScoreGauge({ healthScore, rationale, rationaleLoading }: Props) {
  // Dash the stroke so only `percent` of the circle's circumference is drawn
  // in the foreground color; the rest shows the background-colored circle
  // underneath. Rotating -90deg makes it start at 12 o'clock instead of 3.
  const percent = healthScore.score / 100;
  const dashOffset = CIRCUMFERENCE * (1 - percent);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Health Score</Text>

      <View style={styles.gaugeWrap}>
        <Svg width={SIZE} height={SIZE} style={styles.rotated}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#1a1714"
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.red}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </Svg>
        {/* Centered on top of the ring via absolute position, not rotated */}
        <View style={styles.gaugeCenter}>
          <Text style={styles.scoreText}>{healthScore.score}</Text>
          <Text style={[styles.scoreLabel, { color: scoreLabelColor(healthScore.score) }]}>
            {scoreLabel(healthScore.score)}
          </Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        {BREAKDOWN_ROWS(healthScore).map(({ label, val, max }) => (
          <View key={label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{label}</Text>
            <View style={styles.breakdownTrack}>
              <View style={[styles.breakdownFill, { width: `${(val / max) * 100}%` }]} />
            </View>
            <Text style={styles.breakdownValue}>
              {val}/{max}
            </Text>
          </View>
        ))}
      </View>

      {rationaleLoading ? (
        <Text style={styles.rationaleLoading}>Generating analysis...</Text>
      ) : rationale ? (
        <Text style={styles.rationale}>{rationale}</Text>
      ) : null}
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
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.slateMuted,
  },
  gaugeWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  breakdown: {
    width: '100%',
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    width: 110,
    fontSize: 11,
    color: colors.slateMuted,
  },
  breakdownTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a1714',
  },
  breakdownFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  breakdownValue: {
    width: 36,
    fontSize: 11,
    textAlign: 'right',
    color: colors.text,
  },
  rationaleLoading: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.slateMuted,
    alignSelf: 'flex-start',
  },
  rationale: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    alignSelf: 'flex-start',
  },
});
