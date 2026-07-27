/**
 * Patient consents.
 *
 * These aren't paperwork — they're enforcement points. The backend refuses
 * clinical checklist submission without a `service` consent and blocks photo
 * documentation without a `photo` consent, so a missing consent stops the
 * nurse mid-visit at the patient's door. Granting them here ahead of time is
 * what prevents that.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { EmptyState } from '../components/EmptyState';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import {
  CONSENT_LABELS,
  consentsService,
  type ConsentRecordOut,
  type ConsentType,
} from '../services/consents.service';
import { formatDay } from '../lib/format';

/** The consents a consumer can grant themselves, in the order they matter. */
const GRANTABLE: ConsentType[] = [
  'service',
  'photo',
  'medication',
  'emergency',
  'abha',
  'data_retention',
];

export default function Consents() {
  const params = useLocalSearchParams<{ patientId?: string }>();
  const patients = useStore((s) => s.patients);
  const loadPatients = useStore((s) => s.loadPatients);
  const user = useStore((s) => s.user);

  const [patientId, setPatientId] = useState<string | null>(params.patientId ?? null);
  const [records, setRecords] = useState<ConsentRecordOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPatients().catch(() => {});
  }, [loadPatients]);

  // Default to the only patient when there's no ambiguity.
  useEffect(() => {
    if (!patientId && patients.length > 0) setPatientId(patients[0].id);
  }, [patients, patientId]);

  const load = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setRecords(await consentsService.listForPatient(patientId));
    } catch (e: any) {
      setError(e?.message || 'Could not load consents');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Latest record per type — the list comes back newest-first. */
  const currentFor = (type: ConsentType) => records.find((r) => r.consent_type === type) ?? null;

  const grant = async (type: ConsentType) => {
    if (!patientId) return;
    setBusy(type);
    try {
      await consentsService.give({
        patient_id: patientId,
        consent_type: type,
        consented_by_name: user?.name || undefined,
        relationship_to_patient:
          patients.find((p) => p.id === patientId)?.relationship_to_consumer || undefined,
      });
      await load();
    } catch (e: any) {
      Alert.alert('Could not record consent', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const revoke = (record: ConsentRecordOut, type: ConsentType) => {
    Alert.alert(
      `Withdraw ${CONSENT_LABELS[type].label.toLowerCase()} consent?`,
      type === 'service'
        ? 'Without this consent your nurse cannot deliver care or record clinical notes, and upcoming visits will be blocked.'
        : 'You can grant this again at any time.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setBusy(type);
            try {
              await consentsService.revoke(record.id, 'Withdrawn by consumer');
              await load();
            } catch (e: any) {
              Alert.alert('Could not withdraw', e?.message || 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="consents-screen">
      <OfflineBanner />
      <Header title="Consents" fallbackHref="/(family)/profile" />

      {patients.length === 0 ? (
        <EmptyState
          title="No patients yet"
          description="Consents are recorded against a patient. Add one first."
          icon="people-outline"
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          {patients.length > 1 && (
            <>
              <Text style={styles.fieldLabel}>Patient</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {patients.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, patientId === p.id && styles.chipActive]}
                    onPress={() => setPatientId(p.id)}
                    testID={`consent-patient-${p.id}`}
                  >
                    <Text style={[styles.chipTxt, patientId === p.id && { color: '#fff' }]}>
                      {p.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
              <TouchableOpacity onPress={load}>
                <Text style={styles.retryTxt}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            GRANTABLE.map((type) => {
              const record = currentFor(type);
              const given = record?.status === 'given';
              const meta = CONSENT_LABELS[type];
              return (
                <View key={type} style={styles.card} testID={`consent-${type}`}>
                  <View style={styles.cardHead}>
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: given ? Colors.successBg : Colors.surfaceAlt },
                      ]}
                    >
                      <Ionicons
                        name={given ? 'shield-checkmark' : 'shield-outline'}
                        size={18}
                        color={given ? Colors.success : Colors.textTertiary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.name}>{meta.label}</Text>
                      <Text style={styles.desc}>{meta.description}</Text>
                    </View>
                  </View>

                  <View style={styles.footer}>
                    <Text style={styles.statusTxt}>
                      {given
                        ? `Granted ${formatDay(record!.given_at.slice(0, 10))}`
                        : record
                          ? `Withdrawn — no longer active`
                          : 'Not granted'}
                    </Text>
                    <TouchableOpacity
                      disabled={busy === type}
                      onPress={() => (given ? revoke(record!, type) : grant(type))}
                      style={[styles.btn, given ? styles.btnOutline : styles.btnSolid]}
                      testID={`consent-toggle-${type}`}
                    >
                      {busy === type ? (
                        <ActivityIndicator
                          size="small"
                          color={given ? Colors.danger : '#fff'}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.btnTxt,
                            { color: given ? Colors.danger : '#fff' },
                          ]}
                        >
                          {given ? 'Withdraw' : 'Grant'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { padding: Spacing.xl, alignItems: 'center' },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipRow: { marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  desc: { ...Typography.small, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  statusTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    minWidth: 92,
    alignItems: 'center',
  },
  btnSolid: { backgroundColor: Colors.primary },
  btnOutline: { borderWidth: 1.5, borderColor: Colors.danger },
  btnTxt: { ...Typography.small, fontWeight: '700' as const },
  errorCard: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  errorTxt: { ...Typography.small, color: Colors.danger, textAlign: 'center' },
  retryTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
