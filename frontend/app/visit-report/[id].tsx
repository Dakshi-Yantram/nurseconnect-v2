/**
 * Visit report (nurse app items 2 and 10).
 *
 * There was no report surface at all before this. A nurse could only pass
 * care notes inside the checkout call, there was no way to draft or revise
 * them, and once a visit was marked complete the report became unreachable —
 * which is the specific gap reported for the Visits section.
 *
 * Two entry points:
 *   - before completion, as the required step in front of "Complete Visit"
 *     (the backend returns VISIT_REPORT_REQUIRED and the visit screen sends
 *     the nurse here)
 *   - after completion, from the Visits list, to read or correct a report
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { visitsService } from '../../services/visits.service';

/** Mirrors the backend's baseline floor in care_workflow_engine.py. */
const MIN_CHARS = 1;

interface MissingItem {
  type: string;
  id: string;
  label: string;
  kind: string;
  blocks_checkout: boolean;
}

export default function VisitReport() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = String(id || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [careNotes, setCareNotes] = useState('');
  const [familySummary, setFamilySummary] = useState('');
  const [completed, setCompleted] = useState(false);
  const [missing, setMissing] = useState<MissingItem[]>([]);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setError('');
    try {
      const r = await visitsService.getReport(bookingId);
      setCareNotes(r.care_notes ?? '');
      setFamilySummary(r.family_summary ?? '');
      setCompleted(!!r.check_out_at);
      setMissing((r.missing_items ?? []) as MissingItem[]);
    } catch (e: any) {
      setError(e?.message || 'Could not load this visit report');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (thenGoBack: boolean) => {
    if (careNotes.trim().length < MIN_CHARS) {
      return Alert.alert(
        'Add your visit notes',
        'Describe what you did during this visit — this is what goes on the patient record.',
      );
    }
    if (familySummary.trim().length < MIN_CHARS) {
      return Alert.alert(
        'Add a summary for the family',
        "Write a short plain-language note the patient's family will read.",
      );
    }
    setSaving(true);
    try {
      const r = await visitsService.saveReport(bookingId, {
        care_notes: careNotes.trim(),
        family_summary: familySummary.trim(),
      });
      setMissing((r.missing_items ?? []) as MissingItem[]);
      if (thenGoBack) {
        Alert.alert('Report saved', 'You can now complete this visit.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Saved', 'Your report has been updated.');
      }
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert('Could not save', detail?.message || e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Visit report" showBack fallbackHref="/(nurse)/assignments" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const otherMissing = missing.filter((m) => m.type !== 'report');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="visit-report-screen">
      <OfflineBanner />
      <Header title="Visit report" showBack fallbackHref="/(nurse)/assignments" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && <Text style={styles.errorTxt}>{error}</Text>}

          <View style={[styles.banner, completed ? styles.bannerDone : styles.bannerTodo]}>
            <Ionicons
              name={completed ? 'checkmark-circle' : 'document-text-outline'}
              size={18}
              color={completed ? Colors.success : Colors.primary}
            />
            <Text style={styles.bannerTxt}>
              {completed
                ? 'This visit is complete. You can still correct your report — edits are recorded.'
                : 'Fill this in before you complete the visit. The family sees the summary; the notes stay on the clinical record.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>What you did during this visit</Text>
            <Text style={styles.hint}>
              Observations, care given, anything the next nurse should know.
            </Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="e.g. Dressing changed on left forearm, wound clean, no discharge…"
              placeholderTextColor={Colors.textTertiary}
              value={careNotes}
              onChangeText={setCareNotes}
              testID="report-care-notes"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Summary for the family</Text>
            <Text style={styles.hint}>
              Plain language, no jargon — this is what the family reads in their app.
            </Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="e.g. Amma's dressing was changed today. The wound is healing well…"
              placeholderTextColor={Colors.textTertiary}
              value={familySummary}
              onChangeText={setFamilySummary}
              testID="report-family-summary"
            />
          </View>

          {otherMissing.length > 0 && (
            <View style={styles.missingBox}>
              <Text style={styles.missingTitle}>Also required before completing</Text>
              {otherMissing.map((m) => (
                <View key={`${m.type}-${m.id}`} style={styles.missingRow}>
                  <Ionicons name="ellipse-outline" size={14} color={Colors.warning} />
                  <Text style={styles.missingTxt}>{m.label}</Text>
                </View>
              ))}
            </View>
          )}

          <GradientButton
            title={completed ? 'Save changes' : 'Save report'}
            onPress={() => save(!completed)}
            loading={saving}
            style={{ marginTop: Spacing.md }}
            testID="report-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { ...Typography.small, color: Colors.danger, marginBottom: Spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  bannerTodo: { backgroundColor: Colors.infoBg },
  bannerDone: { backgroundColor: Colors.successBg },
  bannerTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  label: { ...Typography.bodyBold, color: Colors.textPrimary },
  hint: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2, marginBottom: 8 },
  textarea: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
    minHeight: 110,
  },
  missingBox: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 12,
  },
  missingTitle: { ...Typography.small, color: Colors.warning, fontWeight: '700' as const },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  missingTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
});
