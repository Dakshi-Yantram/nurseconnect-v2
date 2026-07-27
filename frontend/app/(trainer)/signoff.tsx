/**
 * Gate 3 — practical sign-off.
 *
 * For care packages configured as `practical_verified`, a nurse is only
 * qualified once a trainer has watched them perform the skill and ticked off
 * the checklist authored on that package. A failed sign-off is recorded too —
 * only a passed one counts toward qualification.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { EmptyState } from '../../components/EmptyState';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import {
  trainingService,
  type PracticalSignOff,
  type PracticalTarget,
  type WorkerSearchResult,
} from '../../services/training.service';
import { relativeTime } from '../../lib/format';

export default function PracticalSignOffScreen() {
  const [targets, setTargets] = useState<PracticalTarget[]>([]);
  const [recent, setRecent] = useState<PracticalSignOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState<PracticalTarget | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [worker, setWorker] = useState<WorkerSearchResult | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [t, r] = await Promise.allSettled([
      trainingService.practicalTargets(),
      trainingService.listPracticalSignOffs(),
    ]);
    if (t.status === 'fulfilled') setTargets(t.value);
    else setError(t.reason?.message || 'Could not load sign-off targets');
    if (r.status === 'fulfilled') setRecent(r.value);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Debounced worker lookup — the endpoint caps at 20 results.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await trainingService.searchWorkers(query.trim());
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const checklist = target?.checklist_items ?? [];
  const allChecked = checklist.length > 0 && checklist.every((c) => checks[c]);
  const anyChecked = checklist.some((c) => checks[c]);

  const reset = () => {
    setTarget(null);
    setWorker(null);
    setQuery('');
    setResults([]);
    setChecks({});
    setNotes('');
  };

  const submit = async (passed: boolean) => {
    if (!target || !worker) return;
    if (!passed && !notes.trim()) {
      Alert.alert(
        'Add a note',
        'Explain what the nurse needs to work on — they’ll see this before retrying.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await trainingService.createPracticalSignOff({
        worker_id: worker.worker_id,
        target_type: target.target_type,
        target_id: target.target_id,
        checklist_responses: checklist.reduce<Record<string, boolean>>((acc, item) => {
          acc[item] = !!checks[item];
          return acc;
        }, {}),
        passed,
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        passed ? 'Signed off' : 'Recorded',
        passed
          ? `${worker.full_name ?? 'This nurse'} is now qualified for ${target.name}.`
          : 'The outcome has been recorded and the nurse can be reassessed later.',
      );
      reset();
      await load();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Practical sign-off" showBack={false} />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="signoff-screen">
      <Header title="Practical sign-off" showBack={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {targets.length === 0 ? (
            <EmptyState
              title="Nothing needs practical sign-off"
              description={
                error ||
                'No care package is currently set to require an observed practical assessment.'
              }
              icon="clipboard-outline"
            />
          ) : (
            <>
              {/* ------------------------------------------------ target -- */}
              <Text style={styles.sectionTitle}>1. What are you signing off?</Text>
              {targets.map((t) => {
                const on = target?.target_id === t.target_id;
                return (
                  <TouchableOpacity
                    key={`${t.target_type}-${t.target_id}`}
                    style={[styles.selectRow, on && styles.selectRowActive]}
                    onPress={() => {
                      setTarget(t);
                      setChecks({});
                    }}
                    testID={`target-${t.target_id}`}
                  >
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectTitle}>{t.name}</Text>
                      <Text style={styles.selectSub}>
                        {t.checklist_items.length} checklist item
                        {t.checklist_items.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* ------------------------------------------------ worker -- */}
              {!!target && (
                <>
                  <Text style={styles.sectionTitle}>2. Who did you observe?</Text>
                  {worker ? (
                    <View style={styles.workerChip}>
                      <Ionicons name="person-circle" size={22} color={Colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workerName}>{worker.full_name || 'Unnamed nurse'}</Text>
                        <Text style={styles.workerMeta}>
                          {[worker.phone_e164, worker.tier].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setWorker(null)}>
                        <Ionicons name="close" size={18} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <InputField
                        placeholder="Search by name or phone"
                        value={query}
                        onChangeText={setQuery}
                        iconLeft="search-outline"
                        autoCapitalize="none"
                        testID="worker-search"
                      />
                      {searching && <ActivityIndicator color={Colors.accent} />}
                      {results.map((w) => (
                        <TouchableOpacity
                          key={w.worker_id}
                          style={styles.resultRow}
                          onPress={() => {
                            setWorker(w);
                            setResults([]);
                            setQuery('');
                          }}
                          testID={`worker-${w.worker_id}`}
                        >
                          <Text style={styles.selectTitle}>{w.full_name || 'Unnamed nurse'}</Text>
                          <Text style={styles.selectSub}>
                            {[w.phone_e164, w.tier].filter(Boolean).join(' · ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {query.trim().length >= 2 && !searching && results.length === 0 && (
                        <Text style={styles.noResults}>No care professionals matched that.</Text>
                      )}
                    </>
                  )}
                </>
              )}

              {/* --------------------------------------------- checklist -- */}
              {!!target && !!worker && (
                <>
                  <Text style={styles.sectionTitle}>3. Competency checklist</Text>
                  {checklist.length === 0 ? (
                    <Text style={styles.noResults}>
                      No checklist items are configured for this package — record the outcome
                      below.
                    </Text>
                  ) : (
                    checklist.map((item) => {
                      const on = !!checks[item];
                      return (
                        <TouchableOpacity
                          key={item}
                          style={styles.checkRow}
                          onPress={() => setChecks((c) => ({ ...c, [item]: !on }))}
                          testID={`check-${item}`}
                        >
                          <View style={[styles.checkbox, on && styles.checkboxOn]}>
                            {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <Text style={styles.checkTxt}>{item}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  <InputField
                    label="Notes"
                    placeholder="What you observed, and anything to work on"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                    testID="signoff-notes"
                  />

                  {checklist.length > 0 && !allChecked && anyChecked && (
                    <View style={styles.warnRow}>
                      <Ionicons name="warning-outline" size={15} color={Colors.warning} />
                      <Text style={styles.warnTxt}>
                        Not every item is ticked. You can still record a fail, but a pass should
                        mean the nurse met the whole checklist.
                      </Text>
                    </View>
                  )}

                  <GradientButton
                    title="Pass — qualify this nurse"
                    onPress={() => submit(true)}
                    disabled={checklist.length > 0 && !allChecked}
                    loading={submitting}
                    style={{ marginTop: Spacing.md }}
                    testID="signoff-pass"
                  />
                  <GradientButton
                    title="Record a fail"
                    variant="outline"
                    onPress={() => submit(false)}
                    loading={submitting}
                    style={{ marginTop: Spacing.sm }}
                    testID="signoff-fail"
                  />
                </>
              )}
            </>
          )}

          {/* -------------------------------------------------- history --- */}
          {recent.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Recent sign-offs</Text>
              {recent.slice(0, 10).map((s) => (
                <View key={s.id} style={styles.historyRow}>
                  <Ionicons
                    name={s.passed ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={s.passed ? Colors.success : Colors.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{s.target_name || 'Care package'}</Text>
                    <Text style={styles.historyMeta}>
                      {s.passed ? 'Passed' : 'Not passed'} · {relativeTime(s.signed_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  selectRowActive: { borderColor: Colors.accent, backgroundColor: '#F5F3FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  selectTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  selectSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: Radius.md,
    padding: 14,
  },
  workerName: { ...Typography.bodyBold, color: Colors.textPrimary },
  workerMeta: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  resultRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
    ...Shadows.card,
  },
  noResults: { ...Typography.small, color: Colors.textTertiary, lineHeight: 18 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1, lineHeight: 21 },
  warnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 12,
  },
  warnTxt: { ...Typography.small, color: Colors.warning, flex: 1, lineHeight: 17 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
  },
  historyTitle: { ...Typography.body, color: Colors.textPrimary },
  historyMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
});
