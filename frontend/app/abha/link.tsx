/**
 * Link a health record to a patient.
 *
 * Persists through `/abha-records` so the record is actually available to the
 * nurse during a visit. The previous version pushed an object into local
 * state and told the user it had been linked — it never left the device.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { abhaService } from '../../services/abha.service';

const TYPES: { key: string; label: string; icon: any; color: string }[] = [
  { key: 'discharge', label: 'Discharge summary', icon: 'file-document-outline', color: Colors.primary },
  { key: 'lab', label: 'Lab report', icon: 'test-tube', color: Colors.success },
  { key: 'prescription', label: 'Prescription', icon: 'pill', color: Colors.warning },
  { key: 'radiology', label: 'Radiology', icon: 'radioactive-circle-outline', color: Colors.error },
];

export default function LinkAbhaRecord() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const patients = useStore((s) => s.patients);
  const loadPatients = useStore((s) => s.loadPatients);

  const [patientId, setPatientId] = useState<string | null>(params.patientId || null);
  const [recordType, setRecordType] = useState('lab');
  const [title, setTitle] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctor, setDoctor] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [summary, setSummary] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPatients().catch(() => {});
  }, [loadPatients]);

  useEffect(() => {
    if (!patientId && patients.length > 0) setPatientId(patients[0].id);
  }, [patients, patientId]);

  const submit = async () => {
    if (!patientId) return Alert.alert('Choose a patient', 'Select who this record belongs to.');
    if (!title.trim()) return Alert.alert('Add a title', 'e.g. “CBC blood panel”.');
    if (issuedDate && !/^\d{4}-\d{2}-\d{2}$/.test(issuedDate.trim())) {
      return Alert.alert('Check the date', 'Use the format YYYY-MM-DD.');
    }

    setSaving(true);
    try {
      await abhaService.create({
        patient_id: patientId,
        record_type: recordType,
        title: title.trim(),
        hospital_name: hospital.trim() || undefined,
        doctor_name: doctor.trim() || undefined,
        issued_date: issuedDate.trim() || undefined,
        summary: summary.trim() || undefined,
        document_url: documentUrl.trim() || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not link record', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="abha-link-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Link a health record" fallbackHref="/abha" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {patients.length > 1 && (
            <>
              <Text style={styles.fieldLabel}>Patient</Text>
              <View style={styles.chipRow}>
                {patients.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, patientId === p.id && styles.chipActive]}
                    onPress={() => setPatientId(p.id)}
                  >
                    <Text style={[styles.chipTxt, patientId === p.id && { color: '#fff' }]}>
                      {p.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Record type</Text>
          <View style={styles.typeGrid}>
            {TYPES.map((t) => {
              const on = recordType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeCard, on && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => setRecordType(t.key)}
                  testID={`abha-type-${t.key}`}
                >
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={22}
                    color={on ? t.color : Colors.textTertiary}
                  />
                  <Text style={[styles.typeTxt, on && { color: t.color, fontWeight: '700' }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <InputField
            label="Title"
            placeholder="e.g. CBC blood panel"
            value={title}
            onChangeText={setTitle}
            testID="abha-title"
          />
          <InputField
            label="Hospital / lab (optional)"
            placeholder="Apollo Hospitals"
            value={hospital}
            onChangeText={setHospital}
          />
          <InputField
            label="Doctor (optional)"
            placeholder="Dr. Meera Rao"
            value={doctor}
            onChangeText={setDoctor}
          />
          <InputField
            label="Issued date (optional)"
            placeholder="YYYY-MM-DD"
            value={issuedDate}
            onChangeText={setIssuedDate}
          />
          <InputField
            label="Document link (optional)"
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            value={documentUrl}
            onChangeText={setDocumentUrl}
          />
          <InputField
            label="Summary (optional)"
            placeholder="Key findings your nurse should know"
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          <GradientButton
            title="Link record"
            onPress={submit}
            loading={saving}
            style={{ marginTop: Spacing.sm }}
            testID="abha-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  typeCard: {
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeTxt: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center' },
});
