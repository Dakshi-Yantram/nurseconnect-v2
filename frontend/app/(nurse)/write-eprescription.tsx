/**
 * Write & issue an e-prescription for a booking, reached from the
 * teleconsult queue once a consultation is in the `prescription` stage.
 * Requires the doctor's signature to already be on file (see
 * eprescription-signature.tsx) — the backend 400s otherwise.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { eprescriptionsService, DrugLine, EPrescriptionOut } from '../../services/eprescriptions.service';
import { teleconsultService } from '../../services/teleconsult.service';

function emptyDrug(): DrugLine {
  return { name: '', dose: '', frequency: '', duration: '', scheduled_drug: false };
}

export default function WriteEPrescriptionScreen() {
  const router = useRouter();
  const { consultId, bookingId } = useLocalSearchParams<{ consultId: string; bookingId: string }>();

  const [drugs, setDrugs] = useState<DrugLine[]>([emptyDrug()]);
  const [dietNotes, setDietNotes] = useState('');
  const [allOkay, setAllOkay] = useState(true);
  const [issues, setIssues] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EPrescriptionOut | null>(null);
  const [completing, setCompleting] = useState(false);

  const updateDrug = (idx: number, patch: Partial<DrugLine>) => {
    setDrugs((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  const addDrug = () => setDrugs((prev) => [...prev, emptyDrug()]);
  const removeDrug = (idx: number) => setDrugs((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    const validDrugs = drugs.filter((d) => d.name.trim());
    if (validDrugs.length === 0) {
      Alert.alert('Add a drug', 'At least one drug is required to issue an e-prescription.');
      return;
    }
    if (!bookingId) {
      Alert.alert('Missing booking', 'This screen needs a booking to issue against.');
      return;
    }
    setSubmitting(true);
    try {
      const out = await eprescriptionsService.create({
        booking_id: bookingId,
        drugs_listed: validDrugs,
        diet_notes: dietNotes.trim() || null,
        patient_issues: allOkay ? null : issues.trim() || null,
      });
      setResult(out);
    } catch (e: any) {
      Alert.alert('Could not issue e-prescription', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finishConsult = async () => {
    if (!consultId) {
      router.back();
      return;
    }
    setCompleting(true);
    try {
      await teleconsultService.complete(consultId);
      Alert.alert('Consultation complete', 'The e-prescription has been issued and shared.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not complete', e?.message ?? 'Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.safe} testID="eprescription-result-screen" edges={['top']}>
        <Header title="E-Prescription Issued" />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60, alignItems: 'center' }}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Prescription generated</Text>
          <Text style={styles.successSub}>Signed, QR-verifiable PDF is ready and linked to this booking.</Text>

          {result.qr_code_url && (
            <Image source={{ uri: result.qr_code_url }} style={styles.qr} resizeMode="contain" />
          )}

          {result.pdf_url && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(result.pdf_url!)}>
              <MaterialCommunityIcons name="file-pdf-box" size={18} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>Open PDF</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={finishConsult} disabled={completing}>
            {completing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Mark consultation complete</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="write-eprescription-screen" edges={['top']}>
      <Header title="Write E-Prescription" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
        <Text style={styles.sectionLabel}>Drugs</Text>
        {drugs.map((drug, idx) => (
          <View key={idx} style={styles.drugCard}>
            <View style={styles.drugHeaderRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Drug name"
                placeholderTextColor={Colors.textTertiary}
                value={drug.name}
                onChangeText={(v) => updateDrug(idx, { name: v })}
              />
              {drugs.length > 1 && (
                <TouchableOpacity onPress={() => removeDrug(idx)} style={styles.removeBtn}>
                  <Ionicons name="close" size={18} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.row3}>
              <TextInput
                style={[styles.input, styles.inputThird]}
                placeholder="Dose"
                placeholderTextColor={Colors.textTertiary}
                value={drug.dose ?? ''}
                onChangeText={(v) => updateDrug(idx, { dose: v })}
              />
              <TextInput
                style={[styles.input, styles.inputThird]}
                placeholder="Frequency"
                placeholderTextColor={Colors.textTertiary}
                value={drug.frequency ?? ''}
                onChangeText={(v) => updateDrug(idx, { frequency: v })}
              />
              <TextInput
                style={[styles.input, styles.inputThird]}
                placeholder="Duration"
                placeholderTextColor={Colors.textTertiary}
                value={drug.duration ?? ''}
                onChangeText={(v) => updateDrug(idx, { duration: v })}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Scheduled drug</Text>
              <Switch
                value={!!drug.scheduled_drug}
                onValueChange={(v) => updateDrug(idx, { scheduled_drug: v })}
                trackColor={{ true: Colors.warning }}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addDrugBtn} onPress={addDrug}>
          <Ionicons name="add" size={16} color={Colors.primary} />
          <Text style={styles.addDrugText}>Add another drug</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Diet notes</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={dietNotes}
          onChangeText={setDietNotes}
          placeholder="Optional — carried over from the consultation if already recorded"
          placeholderTextColor={Colors.textTertiary}
        />

        <Text style={styles.sectionLabel}>Patient issues</Text>
        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>All okay — nothing to flag</Text>
          <Switch value={allOkay} onValueChange={setAllOkay} trackColor={{ true: Colors.success }} />
        </View>
        {!allOkay && (
          <TextInput
            style={styles.textArea}
            multiline
            value={issues}
            onChangeText={setIssues}
            placeholder="Describe what was flagged..."
            placeholderTextColor={Colors.textTertiary}
          />
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-sign" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Issue e-prescription</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  sectionLabel: { ...Typography.small, color: Colors.textTertiary, marginTop: Spacing.md, marginBottom: Spacing.sm, textTransform: 'uppercase', fontWeight: '700' },
  fieldLabel: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' },
  drugCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.card, marginBottom: Spacing.sm, ...Shadows.card },
  drugHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row3: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 10, color: Colors.textPrimary },
  inputThird: { flex: 1 },
  removeBtn: { padding: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  addDrugBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  addDrugText: { color: Colors.primary, fontWeight: '700', fontSize: 13.5 },
  textArea: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, minHeight: 70, textAlignVertical: 'top', color: Colors.textPrimary },
  primaryButton: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10, marginTop: Spacing.md },
  secondaryButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 13.5 },
  successBadge: { marginTop: Spacing.lg },
  successTitle: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.md },
  successSub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: 6 },
  qr: { width: 160, height: 160, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md },
});
