import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { ABHACategory } from '../../types';

const CATS: { key: ABHACategory; label: string; icon: any; color: string }[] = [
  { key: 'discharge', label: 'Discharge summary', icon: 'file-document-outline', color: Colors.primary },
  { key: 'lab', label: 'Lab report', icon: 'test-tube', color: Colors.success },
  { key: 'prescription', label: 'Prescription', icon: 'pill', color: Colors.warning },
  { key: 'radiology', label: 'Radiology', icon: 'radioactive-circle-outline', color: Colors.error },
];

export default function LinkAbhaRecord() {
  const router = useRouter();
  const addAbha = useStore((s) => s.addAbhaRecord);
  const [cat, setCat] = useState<ABHACategory>('lab');
  const [type, setType] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctor, setDoctor] = useState('');
  const [summary, setSummary] = useState('');
  const [picked, setPicked] = useState(false);

  const submit = () => {
    if (!type.trim() || !hospital.trim() || !doctor.trim()) {
      Alert.alert('Please fill all required fields');
      return;
    }
    if (!picked) {
      Alert.alert('Please attach the document');
      return;
    }
    addAbha({
      id: 'a' + Date.now(),
      hospital,
      type,
      category: cat,
      date: new Date().toISOString(),
      doctor,
      summary,
      fileSize: '0.6 MB',
    });
    Alert.alert('Record linked', 'Your record is now visible in ABHA', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="link-abha-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Link new record" fallbackHref="/abha" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <Text style={styles.section}>Category</Text>
          <View style={styles.grid}>
            {CATS.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCat(c.key)}
                style={[styles.catCard, cat === c.key && { borderColor: Colors.primary, borderWidth: 2 }]}
                testID={`cat-${c.key}`}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color + '15' }]}>
                  <MaterialCommunityIcons name={c.icon} size={20} color={c.color} />
                </View>
                <Text style={styles.catTxt}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <InputField label="Record name" placeholder="e.g. Lipid profile" value={type} onChangeText={setType} testID="record-type" />
          <InputField label="Hospital / clinic" placeholder="e.g. Apollo Hospitals" value={hospital} onChangeText={setHospital} testID="record-hospital" />
          <InputField label="Doctor" placeholder="e.g. Dr. R. Mehra" value={doctor} onChangeText={setDoctor} testID="record-doctor" />
          <InputField label="Notes (optional)" placeholder="Any short summary" value={summary} onChangeText={setSummary} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} testID="record-summary" />

          <Text style={styles.section}>Attachment</Text>
          <TouchableOpacity
            style={[styles.attach, picked && styles.attachActive]}
            onPress={() => setPicked(!picked)}
            testID="record-attach"
          >
            <Ionicons name={picked ? 'checkmark-circle' : 'cloud-upload-outline'} size={28} color={picked ? Colors.success : Colors.primary} />
            <Text style={styles.attachTxt}>
              {picked ? 'scan_report.pdf · 0.6 MB' : 'Tap to attach a PDF or image'}
            </Text>
          </TouchableOpacity>

          <GradientButton title="Link record" onPress={submit} testID="link-submit" style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  section: { ...Typography.h4, color: Colors.textPrimary, marginTop: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catCard: { flex: 1, minWidth: '47%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, ...Shadows.card, borderWidth: 1, borderColor: 'transparent' },
  catIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  catTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, padding: 16, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  attachActive: { borderColor: Colors.success, backgroundColor: Colors.successBg },
  attachTxt: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
});
