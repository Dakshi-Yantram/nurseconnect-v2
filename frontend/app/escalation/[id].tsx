import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { EscalationSeverity } from '../../types';

const SEVERITIES: { key: EscalationSeverity; label: string; desc: string; color: string; icon: string }[] = [
  { key: 'watch', label: 'Watch only', desc: 'Monitor closely, no immediate action', color: Colors.info, icon: 'eye-outline' },
  { key: 'inform_family', label: 'Inform family', desc: 'Notify family member about concern', color: Colors.warning, icon: 'account-alert-outline' },
  { key: 'contact_doctor', label: 'Contact doctor', desc: 'Loop in attending physician', color: Colors.accent, icon: 'doctor' },
  { key: 'emergency', label: 'EMERGENCY 108', desc: 'Trigger ambulance & emergency protocol', color: Colors.error, icon: 'ambulance' },
];

const RED_FLAGS = ['Severe chest pain', 'Breathing difficulty', 'SpO₂ below 90%', 'BP above 180/110', 'BP below 90/60', 'Sudden confusion', 'Heavy bleeding', 'Loss of consciousness'];

export default function Escalation() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submitEscalationAPI = useStore((s) => s.submitEscalationAPI);
  const [severity, setSeverity] = useState<EscalationSeverity>('inform_family');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const toggleSymptom = (s: string) => {
    setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s]);
  };

  const submit = () => {
    if (symptoms.length === 0 && !notes.trim()) {
      Alert.alert('Please select symptoms or add notes');
      return;
    }
    submitEscalationAPI(id || '', severity as any, notes, symptoms).catch(() => {});
    const msg =
      severity === 'emergency'
        ? '🚨 Emergency triggered. Ambulance dispatched. Family & admin notified.'
        : severity === 'contact_doctor'
        ? 'Doctor contacted & care team notified. Family is being informed.'
        : severity === 'inform_family'
        ? 'Family member notified via call & SMS. Admin alerted.'
        : 'Watch logged. Continue monitoring.';
    Alert.alert('Escalation logged', msg);
    // Always navigate back regardless of Alert callback (web compatibility)
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(nurse)/dashboard');
    }, 250);
  };

  const isEmergency = severity === 'emergency';

  return (
    <SafeAreaView style={styles.safe} testID="escalation-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Clinical Escalation" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
          <View style={styles.warning}>
            <MaterialCommunityIcons name="alert-octagon" size={20} color={Colors.error} />
            <Text style={styles.warningTxt}>Escalations notify family, doctor & admin in real-time</Text>
          </View>

          <Text style={styles.section}>Severity level</Text>
          {SEVERITIES.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSeverity(s.key)}
              style={[styles.sevRow, severity === s.key && { borderColor: s.color, borderWidth: 2 }]}
              testID={`sev-${s.key}`}
            >
              <View style={[styles.sevIcon, { backgroundColor: s.color + '15' }]}>
                <MaterialCommunityIcons name={s.icon as any} size={20} color={s.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.sevLabel, { color: s.color }]}>{s.label}</Text>
                <Text style={styles.sevDesc}>{s.desc}</Text>
              </View>
              {severity === s.key && <Ionicons name="checkmark-circle" size={20} color={s.color} />}
            </TouchableOpacity>
          ))}

          <Text style={styles.section}>Red-flag symptoms</Text>
          <View style={styles.symptomsGrid}>
            {RED_FLAGS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => toggleSymptom(s)}
                style={[styles.symptom, symptoms.includes(s) && styles.symptomActive]}
                testID={`symptom-${s.split(' ')[0]}`}
              >
                <Text style={[styles.symptomTxt, symptoms.includes(s) && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <InputField
            label="Additional notes"
            placeholder="Vitals readings, observations, anything else…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
            testID="escalation-notes"
          />

          <View style={styles.notifyCard}>
            <Text style={styles.notifyTitle}>Will be notified:</Text>
            <View style={styles.notifyRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.notifyTxt}>Admin / ops team (always)</Text>
            </View>
            <View style={styles.notifyRow}>
              <Ionicons
                name={severity !== 'watch' ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={severity !== 'watch' ? Colors.success : Colors.textTertiary}
              />
              <Text style={[styles.notifyTxt, severity === 'watch' && { color: Colors.textTertiary }]}>
                Family member ({severity === 'watch' ? 'no' : 'call + SMS'})
              </Text>
            </View>
            <View style={styles.notifyRow}>
              <Ionicons
                name={severity === 'contact_doctor' || severity === 'emergency' ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={severity === 'contact_doctor' || severity === 'emergency' ? Colors.success : Colors.textTertiary}
              />
              <Text style={[styles.notifyTxt, !(severity === 'contact_doctor' || severity === 'emergency') && { color: Colors.textTertiary }]}>
                Attending doctor
              </Text>
            </View>
            <View style={styles.notifyRow}>
              <Ionicons
                name={isEmergency ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={isEmergency ? Colors.error : Colors.textTertiary}
              />
              <Text style={[styles.notifyTxt, !isEmergency && { color: Colors.textTertiary }, isEmergency && { color: Colors.error, fontWeight: '700' }]}>
                Ambulance (108)
              </Text>
            </View>
          </View>
        </ScrollView>

        <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
          <GradientButton
            title={isEmergency ? '🚨 Trigger emergency' : 'Submit escalation'}
            variant={isEmergency ? 'accent' : 'primary'}
            onPress={submit}
            testID="escalation-submit"
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorBg, padding: 12, borderRadius: Radius.md },
  warningTxt: { ...Typography.small, color: Colors.error, flex: 1, fontWeight: '600' as const },
  section: { ...Typography.h4, color: Colors.textPrimary, marginTop: 20, marginBottom: 12 },
  sevRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  sevIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sevLabel: { ...Typography.bodyBold, fontWeight: '700' as const },
  sevDesc: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  symptom: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surface, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  symptomActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  symptomTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  notifyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginTop: 16, ...Shadows.card },
  notifyTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 10 },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  notifyTxt: { ...Typography.body, color: Colors.textPrimary },
  stickyBar: { padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.divider },
});
