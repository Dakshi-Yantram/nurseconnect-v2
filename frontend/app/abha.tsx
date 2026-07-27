/**
 * ABHA health records for a patient.
 *
 * Records live against a patient, not the account holder, so this screen
 * picks a patient first and then reads `/abha-records/patient/{id}`. The
 * previous version listed a hardcoded array that was never persisted and was
 * visible to every account.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { EmptyState } from '../components/EmptyState';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { abhaService, type AbhaRecordOut } from '../services/abha.service';
import { formatDay, humanize } from '../lib/format';

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  discharge: { label: 'Discharge', icon: 'file-document-outline', color: Colors.primary },
  lab: { label: 'Lab report', icon: 'test-tube', color: Colors.success },
  prescription: { label: 'Prescription', icon: 'pill', color: Colors.warning },
  radiology: { label: 'Radiology', icon: 'radioactive-circle-outline', color: Colors.error },
};

function metaFor(recordType: string) {
  return (
    TYPE_META[recordType?.toLowerCase()] ?? {
      label: humanize(recordType) || 'Record',
      icon: 'file-document-outline',
      color: Colors.textSecondary,
    }
  );
}

export default function ABHAScreen() {
  const router = useRouter();
  const patients = useStore((s) => s.patients);
  const loadPatients = useStore((s) => s.loadPatients);

  const [patientId, setPatientId] = useState<string | null>(null);
  const [records, setRecords] = useState<AbhaRecordOut[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadPatients().catch(() => {});
    }, [loadPatients]),
  );

  useEffect(() => {
    if (!patientId && patients.length > 0) setPatientId(patients[0].id);
  }, [patients, patientId]);

  const load = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setRecords(await abhaService.listForPatient(patientId));
    } catch (e: any) {
      setError(e?.message || 'Could not load health records');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const categories = useMemo(() => {
    const set = new Set(records.map((r) => r.record_type?.toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [records]);

  const filtered =
    filter === 'all' ? records : records.filter((r) => r.record_type?.toLowerCase() === filter);

  if (patients.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Health records" fallbackHref="/(family)/profile" />
        <EmptyState
          title="No patients yet"
          description="Health records are stored against a patient. Add one to link their records."
          icon="people-outline"
          ctaTitle="Add patient"
          onCtaPress={() => router.push('/patients')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="abha-screen" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Health records"
        fallbackHref="/(family)/profile"
        rightIcon="add"
        onRightPress={() =>
          router.push({ pathname: '/abha/link', params: { patientId: patientId ?? '' } })
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {patients.length > 1 && (
          <>
            <Text style={styles.fieldLabel}>Patient</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, patientId === p.id && styles.chipActive]}
                  onPress={() => setPatientId(p.id)}
                  testID={`abha-patient-${p.id}`}
                >
                  <Text style={[styles.chipTxt, patientId === p.id && { color: '#fff' }]}>
                    {p.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {categories.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, filter === c && styles.chipActive]}
                onPress={() => setFilter(c)}
              >
                <Text style={[styles.chipTxt, filter === c && { color: '#fff' }]}>
                  {c === 'all' ? 'All' : metaFor(c).label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={20} color={Colors.danger} />
            <Text style={styles.errorTxt}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryTxt}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No records yet"
            description="Link a discharge summary, lab report or prescription so your nurse has the full picture."
            icon="document-text-outline"
            ctaTitle="Link a record"
            onCtaPress={() =>
              router.push({ pathname: '/abha/link', params: { patientId: patientId ?? '' } })
            }
          />
        ) : (
          filtered.map((r) => {
            const meta = metaFor(r.record_type);
            return (
              <TouchableOpacity
                key={r.id}
                style={styles.recordCard}
                onPress={() => router.push({ pathname: '/abha/[id]', params: { id: r.id } })}
                testID={`abha-record-${r.id}`}
              >
                <View style={[styles.recordIcon, { backgroundColor: meta.color + '18' }]}>
                  <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.recordTitle} numberOfLines={1}>
                    {r.title || meta.label}
                  </Text>
                  <Text style={styles.recordMeta} numberOfLines={1}>
                    {[r.hospital_name, r.doctor_name].filter(Boolean).join(' · ') || meta.label}
                  </Text>
                  {!!r.issued_date && (
                    <Text style={styles.recordDate}>{formatDay(r.issued_date.slice(0, 10))}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipScroll: { marginBottom: Spacing.md },
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
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  recordIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  recordMeta: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  recordDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 3 },
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
