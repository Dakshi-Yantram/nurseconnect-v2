/**
 * Health record detail.
 *
 * The record is looked up through the patient's record list rather than a
 * per-record endpoint (the backend only exposes the list). Sharing is not
 * offered here: records are already visible to the assigned nurse for the
 * duration of a visit, so a "share" button would imply a control that
 * doesn't exist.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { abhaService, type AbhaRecordOut } from '../../services/abha.service';
import { formatDay, humanize } from '../../lib/format';

export default function AbhaRecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patients = useStore((s) => s.patients);
  const loadPatients = useStore((s) => s.loadPatients);

  const [record, setRecord] = useState<AbhaRecordOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPatients().catch(() => {});
  }, [loadPatients]);

  const load = useCallback(async () => {
    if (!id || patients.length === 0) return;
    setError('');
    try {
      // No per-record endpoint exists, so scan the patients' lists for it.
      for (const p of patients) {
        const rows = await abhaService.listForPatient(p.id);
        const found = rows.find((r) => r.id === id);
        if (found) {
          setRecord(found);
          return;
        }
      }
      setError('This record could not be found.');
    } catch (e: any) {
      setError(e?.message || 'Could not load this record');
    } finally {
      setLoading(false);
    }
  }, [id, patients]);

  useEffect(() => {
    if (patients.length > 0) load();
    else if (!loading) setLoading(false);
  }, [patients, load, loading]);

  const openDocument = () => {
    if (!record?.document_url) return;
    Linking.openURL(record.document_url).catch(() =>
      Alert.alert('Could not open', 'The document link appears to be invalid.'),
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Health record" fallbackHref="/abha" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Health record" fallbackHref="/abha" />
        <View style={styles.centered}>
          <Ionicons name="document-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error || 'This record could not be found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const heading = record.title || humanize(record.record_type) || 'Health record';

  return (
    <SafeAreaView style={styles.safe} testID="abha-record-detail" edges={['top']}>
      <OfflineBanner />
      <Header title={heading} fallbackHref="/abha" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        <View style={styles.card}>
          <View style={styles.iconHero}>
            <MaterialCommunityIcons name="file-document-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{heading}</Text>
          {!!record.hospital_name && <Text style={styles.sub}>{record.hospital_name}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.secTitle}>Details</Text>
          <Row label="Type" value={humanize(record.record_type)} />
          {!!record.doctor_name && <Row label="Doctor" value={record.doctor_name} />}
          {!!record.issued_date && (
            <Row label="Issued" value={formatDay(record.issued_date.slice(0, 10))} />
          )}
          {!!record.source && <Row label="Source" value={humanize(record.source)} />}
          <Row label="Added" value={formatDay(record.created_at.slice(0, 10))} />
        </View>

        {!!record.summary && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Summary</Text>
            <Text style={styles.body}>{record.summary}</Text>
          </View>
        )}

        {record.document_url ? (
          <GradientButton
            title="Open document"
            onPress={openDocument}
            testID="abha-open-btn"
            style={{ marginTop: Spacing.md }}
            icon={<Ionicons name="open-outline" size={18} color="#fff" />}
          />
        ) : (
          <View style={styles.noDoc}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.noDocTxt}>
              No document file is attached to this record — only the details above.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.kv}>
    <Text style={styles.k}>{label}</Text>
    <Text style={styles.v}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: 'center',
    ...Shadows.card,
  },
  iconHero: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h3, color: Colors.textPrimary, marginTop: 12, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  secTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  k: { ...Typography.body, color: Colors.textSecondary },
  v: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  body: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  noDoc: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  noDocTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});
