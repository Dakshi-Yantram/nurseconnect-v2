import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';

const PRIVACY_OPTIONS = [
  { key: 'share_abha', label: 'Share ABHA records with nurses', desc: 'Allow assigned nurses to view your linked health records', default: true },
  { key: 'analytics', label: 'Anonymous usage analytics', desc: 'Help us improve the app', default: true },
  { key: 'marketing', label: 'Marketing emails & SMS', desc: 'Offers, subsidy news & wellness tips', default: false },
  { key: 'location', label: 'Location services', desc: 'Auto-fill your address & find nearby nurses', default: true },
  { key: 'biometric', label: 'Biometric login', desc: 'Use Face ID / fingerprint to unlock', default: false },
];

export default function Privacy() {
  const [state, setState] = useState<Record<string, boolean>>(
    PRIVACY_OPTIONS.reduce((acc, o) => ({ ...acc, [o.key]: o.default }), {})
  );

  const toggle = (k: string) => setState({ ...state, [k]: !state[k] });

  return (
    <SafeAreaView style={styles.safe} testID="privacy-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Privacy & Data" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.success} />
          <Text style={styles.bannerTxt}>
            Your data is end-to-end encrypted. We never sell your information.
          </Text>
        </View>

        {PRIVACY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={styles.row}
            onPress={() => toggle(opt.key)}
            testID={`privacy-${opt.key}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{opt.label}</Text>
              <Text style={styles.desc}>{opt.desc}</Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: state[opt.key] ? Colors.primary : Colors.border }]}>
              <View style={[styles.toggleKnob, state[opt.key] && { transform: [{ translateX: 18 }] }]} />
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.danger}
          onPress={() => Linking.openURL('https://nurseconnect.co.in/privacy-policy')}
          testID="read-privacy-policy"
        >
          <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
          <Text style={styles.dangerTxt}>Read full privacy policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.danger}
          onPress={() => Alert.alert('Download data', 'Your data export is being prepared. Check email in 24 hours.')}
          testID="download-data"
        >
          <Ionicons name="download-outline" size={18} color={Colors.primary} />
          <Text style={styles.dangerTxt}>Download all my data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.danger, { backgroundColor: Colors.errorBg }]}
          onPress={() =>
            Alert.alert('Delete account', 'This will permanently erase your data. Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Request received', 'Account will be deleted in 30 days') },
            ])
          }
          testID="delete-account"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={[styles.dangerTxt, { color: Colors.error }]}>Delete my account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.successBg, padding: 14, borderRadius: Radius.lg, marginBottom: 16 },
  bannerTxt: { ...Typography.small, color: Colors.success, flex: 1, fontWeight: '600' as const },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 8, ...Shadows.card },
  label: { ...Typography.bodyBold, color: Colors.textPrimary },
  desc: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  toggle: { width: 42, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.infoBg, padding: 14, borderRadius: Radius.lg, marginTop: 12 },
  dangerTxt: { ...Typography.bodyBold, color: Colors.primary },
});