// Mobile port of frontend/src/components/InputArea.tsx's "paste" tab.
// Upload tab is a placeholder — native file upload needs
// expo-document-picker, which is its own lesson.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/colors';
import { parseText } from '@/lib/api';
import type { FinancialData } from '@/types';

const SAMPLE = `Business: Riverside Landscaping LLC · FY 2023
Revenue: $1,840,000
COGS (labor + materials): $1,102,000
Gross Profit: $738,000 (40.1%)
Operating Expenses: $312,000
  — Owner salary: $120,000
  — Rent: $36,000
  — Marketing: $28,000
  — Misc: $128,000
EBITDA: $426,000
Owner SDE: ~$546,000
YoY Revenue Growth: +14%
Employees: 11 FT, 4 seasonal
Notes: Lost one major HOA contract in Q4. New equipment lease starts Jan 2024.`;

type Tab = 'paste' | 'upload';

interface Props {
  onParsed: (data: FinancialData) => void;
}

export function InputArea({ onParsed }: Props) {
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      onParsed(await parseText(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canAnalyze = tab === 'paste' && text.trim().length > 0;

  return (
    <View>
      <Text style={styles.eyebrow}>Business Health Dashboard</Text>
      <Text style={styles.heading}>What's your business{'\n'}actually worth?</Text>
      <Text style={styles.subheading}>
        Drop in your P&L. Get a score, insights, and what to fix — in under 60 seconds.
      </Text>

      <View style={styles.card}>
        <View style={styles.tabRow}>
          {(['paste', 'upload'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tabButton}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'paste' ? '📋  Paste Text' : '📁  Upload File'}
              </Text>
              {tab === t && <View style={styles.tabIndicator} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.cardBody}>
          {tab === 'paste' ? (
            <>
              <Text style={styles.fieldLabel}>Your P&L, revenue data, or financial summary</Text>
              <TextInput
                style={styles.textarea}
                value={text}
                onChangeText={setText}
                placeholder={'Paste anything — messy is fine. For example:\n\nRevenue: $1,840,000\nCOGS: $1,102,000...'}
                placeholderTextColor={colors.slateMuted}
                multiline
                editable={!loading}
              />
              <Pressable onPress={() => setText(SAMPLE)}>
                <Text style={styles.sampleLink}>↓ Load example — Riverside Landscaping LLC (FY 2023)</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadEmoji}>📄</Text>
              <Text style={styles.uploadText}>File upload coming in the next lesson</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !canAnalyze}
            style={[styles.cta, (loading || !canAnalyze) && styles.ctaDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Get My Score →</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.slateDim,
    marginBottom: 8,
  },
  heading: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 36,
    marginBottom: 8,
  },
  subheading: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.slateMuted,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slateMuted,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.maroon,
  },
  cardBody: {
    padding: 20,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.slateMuted,
  },
  textarea: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#111110',
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
    padding: 14,
    textAlignVertical: 'top',
  },
  sampleLink: {
    fontSize: 12,
    color: colors.slateMuted,
  },
  uploadPlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: '#111110',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadEmoji: {
    fontSize: 28,
  },
  uploadText: {
    color: colors.slateMuted,
    fontSize: 13,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.maroon,
    backgroundColor: '#1a0a0a',
  },
  errorText: {
    color: '#f6c6c3',
    fontSize: 13,
  },
  cta: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.3,
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
