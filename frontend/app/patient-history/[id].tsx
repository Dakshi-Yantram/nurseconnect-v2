/**
 * Patient care history — nurse-facing.
 *
 * Lets a nurse see what previous visits (by her or any other nurse) recorded
 * for this patient — care notes, vitals, checklist — before she arrives.
 * Backed by GET /workers/patients/{id}/history, which only returns data if
 * the requesting nurse has been assigned to at least one booking for this
 * patient (enforced server-side).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { formatDay } from '../../lib/format';
import {
  workerSelfService,
  type PatientHistoryResponse,
  type PatientVisitHistoryItem,
} from '../../services/worker-self.service';

export default function PatientHistory() {
  const router = useRouter();
  const { id: patientId } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<PatientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await workerSelfService.patientHistory(patientId);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load patient history.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="patient-history-screen">
      <OfflineBanner />
      <Header title="Patient history" fallbackHref="/(nurse)/assignments" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={styles.errorTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} testID="retry-history">
            <Text style={styles.retryTxt}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          {data?.patient && (
            <View style={styles.patientCard} testID="patient-summary">
              <View style={styles.patientHead}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.patientName}>{data.patient.full_name}</Text>
                  <Text style={styles.patientSub}>
                    {data.patient.gender ? `${data.patient.gender} · ` : ''}
                    {data.patient.date_of_birth ? `Born ${formatDay(data.patient.date_of_birth)}` : ''}
                    {data.patient.blood_group ? ` · ${data.patient.blood_group}` : ''}
                  </Text>
                </View>
              </View>

              {(data.patient.medical_conditions?.length ?? 0) > 0 && (
                <Tags label="Conditions" items={data.patient.medical_conditions!} tone="warning" />
              )}
              {(data.patient.allergies?.length ?? 0) > 0 && (
                <Tags label="Allergies" items={data.patient.allergies!} tone="danger" />
              )}
              {(data.patient.current_medications?.length ?? 0) > 0 && (
                <Tags
                  label="Current medications"
                  items={data.patient.current_medications!.map((m) => m.name || String(m))}
                  tone="warning"
                />
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Past visits</Text>
          {(!data || data.visits.length === 0) && (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.emptyTxt}>No completed visits recorded for this patient yet.</Text>
            </View>
          )}
          {data?.visits.map((v) => <VisitCard key={v.visit_id} visit={v} />)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const VisitCard: React.FC<{ visit: PatientVisitHistoryItem }> = ({ visit }) => (
  <View style={styles.visitCard} testID={`history-visit-${visit.visit_id}`}>
    <View style={styles.visitHead}>
      <Text style={styles.visitDate}>{formatDay(visit.scheduled_date)}</Text>
      <Text style={styles.visitNurse}>{visit.worker_name || 'Care professional'}</Text>
    </View>

    {!!visit.care_notes && (
      <View style={styles.notesBox}>
        <Text style={styles.notesLabel}>Care notes</Text>
        <Text style={styles.notesTxt}>{visit.care_notes}</Text>
      </View>
    )}

    {!!visit.family_summary && (
      <View style={styles.notesBox}>
        <Text style={styles.notesLabel}>Family summary</Text>
        <Text style={styles.notesTxt}>{visit.family_summary}</Text>
      </View>
    )}

    {(visit.vitals?.length ?? 0) > 0 && (
      <View style={{ marginTop: Spacing.sm }}>
        <Text style={styles.notesLabel}>Vitals recorded</Text>
        {visit.vitals!.map((v, i) => (
          <Text key={i} style={styles.vitalsRow}>
            {[
              v.bp ? `BP ${v.bp}` : null,
              v.pulse != null ? `Pulse ${v.pulse}` : null,
              v.spo2 != null ? `SpO2 ${v.spo2}%` : null,
              v.temperature_f != null ? `Temp ${v.temperature_f}°F` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ))}
      </View>
    )}
  </View>
);

const Tags: React.FC<{ label: string; items: string[]; tone: 'warning' | 'danger' }> = ({
  label,
  items,
  tone,
}) => (
  <View style={{ marginTop: Spacing.md }}>
    <Text style={styles.tagLabel}>{label}</Text>
    <View style={styles.tagRow}>
      {items.map((t, i) => (
        <View
          key={`${t}-${i}`}
          style={[
            styles.tag,
            { backgroundColor: tone === 'danger' ? Colors.errorBg : Colors.warningBg },
          ]}
        >
          <Text style={[styles.tagTxt, { color: tone === 'danger' ? Colors.danger : Colors.warning }]}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.lg },
  errorTxt: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  retryTxt: { ...Typography.small, color: '#fff', fontWeight: '700' as const },
  patientCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  patientHead: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientName: { ...Typography.h4, color: Colors.textPrimary },
  patientSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tagLabel: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  tagTxt: { ...Typography.caption, fontWeight: '600' as const },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  emptyTxt: { ...Typography.small, color: Colors.textTertiary, textAlign: 'center' },
  visitCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  visitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDate: { ...Typography.bodyBold, color: Colors.textPrimary },
  visitNurse: { ...Typography.small, color: Colors.textSecondary },
  notesBox: { marginTop: Spacing.sm },
  notesLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  notesTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
  vitalsRow: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
