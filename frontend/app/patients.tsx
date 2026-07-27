/**
 * Patients — the people a consumer books care for.
 *
 * Every booking must name a patient, and the clinical record (vitals,
 * medications, consents, ABHA records) hangs off the patient rather than the
 * account holder, so this is a prerequisite for booking at all.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { usersService, type PatientOut } from '../services/users.service';
import { formatDay } from '../lib/format';

const RELATIONSHIPS = ['Self', 'Parent', 'Spouse', 'Child', 'Sibling', 'Grandparent', 'Other'];
const GENDERS: { id: 'male' | 'female' | 'other'; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
];

interface FormState {
  full_name: string;
  relationship_to_consumer: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  blood_group: string;
  medical_conditions: string;
  allergies: string;
  current_medications: string;
}

const EMPTY: FormState = {
  full_name: '',
  relationship_to_consumer: 'Parent',
  gender: 'female',
  date_of_birth: '',
  blood_group: '',
  medical_conditions: '',
  allergies: '',
  current_medications: '',
};

export default function Patients() {
  const router = useRouter();
  const patients = useStore((s) => s.patients);
  const state = useStore((s) => s.loadState.patients);
  const loadPatients = useStore((s) => s.loadPatients);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PatientOut | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPatients().catch(() => {});
    }, [loadPatients]),
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setEditorOpen(true);
  };

  const openEdit = (p: PatientOut) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      relationship_to_consumer: p.relationship_to_consumer || 'Other',
      gender: (p.gender as FormState['gender']) || 'female',
      date_of_birth: p.date_of_birth ?? '',
      blood_group: p.blood_group ?? '',
      medical_conditions: (p.medical_conditions ?? []).join(', '),
      allergies: (p.allergies ?? []).join(', '),
      current_medications: (p.current_medications ?? []).map((m) => m.name).join(', '),
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) {
      Alert.alert('Name needed', 'Enter the patient’s full name.');
      return;
    }
    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth.trim())) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD, for example 1958-04-21.');
      return;
    }
    setSaving(true);
    try {
      // The service layer splits the comma-separated clinical fields into the
      // arrays the API expects.
      const payload = {
        full_name: form.full_name.trim(),
        relationship_to_consumer: form.relationship_to_consumer,
        gender: form.gender,
        date_of_birth: form.date_of_birth.trim() || undefined,
        blood_group: form.blood_group.trim() || undefined,
        medical_conditions: form.medical_conditions,
        allergies: form.allergies,
        current_medications: form.current_medications,
      };
      if (editing) {
        await usersService.updatePatient(editing.id, payload);
      } else {
        await usersService.createPatient(payload);
      }
      await loadPatients();
      setEditorOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="patients-screen">
      <OfflineBanner />
      <Header
        title="Patients"
        fallbackHref="/(family)/profile"
        rightIcon="add"
        onRightPress={openNew}
      />

      <AsyncBoundary
        state={state}
        isEmpty={patients.length === 0}
        emptyTitle="No patients yet"
        emptyDescription="Add the person you’re booking care for. Their clinical record — vitals, medications and consents — is kept against their profile."
        emptyIcon="people-outline"
        emptyCtaTitle="Add patient"
        onEmptyCtaPress={openNew}
        onRetry={() => loadPatients()}
      >
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          {patients.map((p) => (
            <View key={p.id} style={styles.card} testID={`patient-${p.id}`}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{p.full_name}</Text>
                  <Text style={styles.rel}>
                    {p.relationship_to_consumer}
                    {p.date_of_birth ? ` · Born ${formatDay(p.date_of_birth)}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(p)} testID={`edit-patient-${p.id}`}>
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {(p.medical_conditions?.length ?? 0) > 0 && (
                <Tags label="Conditions" items={p.medical_conditions ?? []} tone="warning" />
              )}
              {(p.allergies?.length ?? 0) > 0 && (
                <Tags label="Allergies" items={p.allergies ?? []} tone="danger" />
              )}

              <TouchableOpacity
                style={styles.consentRow}
                onPress={() =>
                  router.push({ pathname: '/consents', params: { patientId: p.id } })
                }
                testID={`consents-${p.id}`}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
                <Text style={styles.consentTxt}>Manage consents</Text>
                <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </AsyncBoundary>

      {/* ------------------------------------------------------ editor ---- */}
      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header
            title={editing ? 'Edit patient' : 'Add patient'}
            showBack={false}
            rightIcon="close"
            onRightPress={() => setEditorOpen(false)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <InputField
                label="Full name"
                placeholder="Patient’s full name"
                value={form.full_name}
                onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
                testID="patient-name"
              />

              <Text style={styles.fieldLabel}>Relationship to you</Text>
              <View style={styles.chipRow}>
                {RELATIONSHIPS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, form.relationship_to_consumer === r && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, relationship_to_consumer: r }))}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        form.relationship_to_consumer === r && { color: '#fff' },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, form.gender === g.id && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, gender: g.id }))}
                  >
                    <Text style={[styles.chipTxt, form.gender === g.id && { color: '#fff' }]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <InputField
                label="Date of birth (optional)"
                placeholder="YYYY-MM-DD"
                value={form.date_of_birth}
                onChangeText={(v) => setForm((f) => ({ ...f, date_of_birth: v }))}
                testID="patient-dob"
              />
              <InputField
                label="Blood group (optional)"
                placeholder="O+"
                autoCapitalize="characters"
                value={form.blood_group}
                onChangeText={(v) => setForm((f) => ({ ...f, blood_group: v }))}
              />

              <Text style={styles.sectionNote}>
                Clinical details help the nurse prepare and drive safety checks during the visit.
                Separate multiple entries with commas.
              </Text>

              <InputField
                label="Medical conditions"
                placeholder="Type 2 diabetes, hypertension"
                value={form.medical_conditions}
                onChangeText={(v) => setForm((f) => ({ ...f, medical_conditions: v }))}
                multiline
              />
              <InputField
                label="Allergies"
                placeholder="Penicillin, latex"
                value={form.allergies}
                onChangeText={(v) => setForm((f) => ({ ...f, allergies: v }))}
                multiline
              />
              <InputField
                label="Current medications"
                placeholder="Metformin 500mg, Amlodipine 5mg"
                value={form.current_medications}
                onChangeText={(v) => setForm((f) => ({ ...f, current_medications: v }))}
                multiline
              />

              <GradientButton
                title={editing ? 'Save changes' : 'Add patient'}
                onPress={save}
                loading={saving}
                style={{ marginTop: Spacing.md }}
                testID="patient-save"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Tags: React.FC<{ label: string; items: string[]; tone: 'warning' | 'danger' }> = ({
  label,
  items,
  tone,
}) => (
  <View style={{ marginTop: Spacing.md }}>
    <Text style={styles.tagLabel}>{label}</Text>
    <View style={styles.tagRow}>
      {items.map((t) => (
        <View
          key={t}
          style={[
            styles.tag,
            { backgroundColor: tone === 'danger' ? Colors.errorBg : Colors.warningBg },
          ]}
        >
          <Text
            style={[
              styles.tagTxt,
              { color: tone === 'danger' ? Colors.danger : Colors.warning },
            ]}
          >
            {t}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.h4, color: Colors.textPrimary },
  rel: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tagLabel: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  tagTxt: { ...Typography.caption, fontWeight: '600' as const },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  consentTxt: { ...Typography.small, color: Colors.primary, fontWeight: '600' as const, flex: 1 },
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
  sectionNote: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    lineHeight: 17,
  },
});
