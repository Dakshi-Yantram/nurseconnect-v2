/**
 * Clinical training lead: assessment attempts taken by nurses.
 *
 * Read-only. It exists so a lead can spot an assessment that everyone fails
 * (usually a badly worded question) or a nurse who needs support, before
 * either shows up as a clinical problem.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { trainingService, type AttemptRow } from '../../services/training.service';
import { relativeTime } from '../../lib/format';

type Filter = 'all' | 'passed' | 'failed';

export default function LeadAttempts() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setError('');
    try {
      setAttempts(await trainingService.listAttempts());
    } catch (e: any) {
      setError(e?.message || 'Could not load attempts');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(() => {
    if (filter === 'passed') return attempts.filter((a) => a.passed);
    if (filter === 'failed') return attempts.filter((a) => !a.passed);
    return attempts;
  }, [attempts, filter]);

  const passRate = attempts.length
    ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="lead-attempts">
      <Header title="Assessment attempts" showBack={false} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      ) : attempts.length === 0 ? (
        <EmptyState
          title="No attempts yet"
          description="Once nurses start taking your published assessments, their results appear here."
          icon="stats-chart-outline"
        />
      ) : (
        <>
          {passRate !== null && (
            <View style={styles.summary}>
              <Text style={styles.summaryValue}>{passRate}%</Text>
              <Text style={styles.summaryLabel}>
                pass rate across {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          <View style={styles.tabs}>
            {(['all', 'passed', 'failed'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.tab, filter === f && styles.tabActive]}
                onPress={() => setFilter(f)}
                testID={`attempts-${f}`}
              >
                <Text style={[styles.tabTxt, filter === f && styles.tabTxtActive]}>
                  {f === 'all' ? 'All' : f === 'passed' ? 'Passed' : 'Not passed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
          >
            {visible.length === 0 ? (
              <Text style={styles.noneTxt}>
                No attempts match this filter.
              </Text>
            ) : (
              visible.map((a) => (
                <View key={a.attempt_id} style={styles.row} testID={`attempt-${a.attempt_id}`}>
                  <View
                    style={[
                      styles.scoreCircle,
                      { backgroundColor: a.passed ? Colors.successBg : Colors.errorBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreTxt,
                        { color: a.passed ? Colors.success : Colors.danger },
                      ]}
                    >
                      {a.score}%
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{a.worker_name || 'Unnamed nurse'}</Text>
                    <Text style={styles.assessmentCode}>{a.assessment_code || 'Assessment'}</Text>
                    {!!a.submitted_at && (
                      <Text style={styles.time}>{relativeTime(a.submitted_at)}</Text>
                    )}
                  </View>
                  <Ionicons
                    name={a.passed ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={a.passed ? Colors.success : Colors.danger}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  summary: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    alignItems: 'center',
    ...Shadows.card,
  },
  summaryValue: { ...Typography.h1, color: Colors.textPrimary, fontWeight: '800' as const },
  summaryLabel: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginVertical: Spacing.sm,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  tabTxtActive: { color: Colors.primary },
  noneTxt: { ...Typography.small, color: Colors.textTertiary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTxt: { ...Typography.bodyBold, fontWeight: '800' as const },
  workerName: { ...Typography.bodyBold, color: Colors.textPrimary },
  assessmentCode: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  time: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
});
