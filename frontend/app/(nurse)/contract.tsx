/**
 * Provider contract screen — Stage 1 in-app clickwrap (checkbox + OTP) and
 * Stage 2 Master Agreement (unlocked after first completed booking,
 * executed via Aadhaar eSign).
 *
 * All contract text is rendered server-side per provider type — this
 * screen never hardcodes wording, name, or registration number. It just
 * displays whatever GET /contracts/me returns and posts the accept action.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { contractsService, ContractPreview } from '../../services/contracts.service';

export default function ContractScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractPreview[]>([]);
  const [activeStage, setActiveStage] = useState<1 | 2>(1);
  const [checked, setChecked] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contractsService.getMyContracts();
      setContracts(data);
      // Land on whichever stage is currently actionable.
      const actionable = data.find((c: ContractPreview) => c.unlocked);
      if (actionable) setActiveStage(actionable.stage);
    } catch (e: any) {
      Alert.alert('Could not load contract', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const stage1 = contracts.find((c: ContractPreview) => c.stage === 1);
  const stage2 = contracts.find((c: ContractPreview) => c.stage === 2);
  const current = activeStage === 1 ? stage1 : stage2;

  const handleSendOtp = async () => {
    setSubmitting(true);
    try {
      const res = await contractsService.sendStage1Otp();
      setOtpSent(true);
      setDevOtp(res.dev_otp);
    } catch (e: any) {
      Alert.alert('Could not send OTP', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptStage1 = async () => {
    if (!checked) {
      Alert.alert('Please accept the terms', 'Tick the checkbox to confirm you agree.');
      return;
    }
    if (otp.trim().length < 4) {
      Alert.alert('Enter the OTP', 'Check your SMS for the code we sent.');
      return;
    }
    setSubmitting(true);
    try {
      await contractsService.acceptStage1(otp.trim());
      Alert.alert('Agreement accepted', 'You now have full app access.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      load();
    } catch (e: any) {
      Alert.alert('Could not accept', e?.response?.data?.detail ?? e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Stage 2 e-sign is expected to be completed via the Digio/Leegality/ASP
  // hosted signing flow (opened in a WebView by the caller of this screen);
  // this screen records the outcome once that session hands back a
  // reference id. Wire `startEsignSession(...)` to your ASP's SDK/redirect
  // URL when that integration is ready.
  const handleAcceptStage2 = async (esignReferenceId: string, esignDocumentUrl?: string) => {
    setSubmitting(true);
    try {
      await contractsService.acceptStage2({
        esign_reference_id: esignReferenceId,
        esign_document_url: esignDocumentUrl,
        esign_provider: 'digio',
      });
      Alert.alert('Master Agreement executed', 'You can now accept your next booking.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      load();
    } catch (e: any) {
      Alert.alert('Could not execute agreement', e?.response?.data?.detail ?? e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Partner Agreement" showBack />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Partner Agreement" showBack />

      <View style={styles.tabRow}>
        {[1, 2].map((s) => {
          const stageData = s === 1 ? stage1 : stage2;
          const isActive = activeStage === s;
          const disabled = stageData?.status === 'not_applicable';
          return (
            <TouchableOpacity
              key={s}
              style={[styles.tab, isActive && styles.tabActive, disabled && styles.tabDisabled]}
              disabled={disabled}
              onPress={() => setActiveStage(s as 1 | 2)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                Stage {s} {stageData?.status === 'accepted' ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {current?.status === 'not_applicable' ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.lockedText}>{current.reason}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.contractText}>{current?.rendered_text}</Text>
          </View>

          {current?.status === 'accepted' ? (
            <View style={styles.acceptedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.acceptedBannerText}>Accepted — no action needed.</Text>
            </View>
          ) : activeStage === 1 ? (
            <View style={styles.actionArea}>
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setChecked((c) => !c)}>
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? Colors.primary : Colors.textTertiary}
                />
                <Text style={styles.checkboxLabel}>I have read and accept these terms.</Text>
              </TouchableOpacity>

              {!otpSent ? (
                <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
                </TouchableOpacity>
              ) : (
                <>
                  {devOtp ? <Text style={styles.devOtpHint}>Dev OTP: {devOtp}</Text> : null}
                  <TextInput
                    style={styles.otpInput}
                    placeholder="Enter OTP"
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                    maxLength={6}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={handleAcceptStage1} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Accept & Continue</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.actionArea}>
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={submitting}
                onPress={() =>
                  Alert.alert(
                    'e-Sign required',
                    'This will open Aadhaar eSign on Telangana e-Stamp paper. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        // Replace with the real ASP redirect/SDK callback —
                        // it should resolve to (referenceId, documentUrl).
                        onPress: () => handleAcceptStage2('PENDING_ASP_INTEGRATION'),
                      },
                    ],
                  )
                }
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Execute via Aadhaar eSign</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  lockedText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginTop: Spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabDisabled: { opacity: 0.4 },
  tabText: { ...Typography.small, color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  contractText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 21 },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.lg,
  },
  acceptedBannerText: { ...Typography.body, color: '#16A34A' },
  actionArea: { marginTop: Spacing.md, gap: Spacing.sm },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkboxLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  otpInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  devOtpHint: { ...Typography.caption, color: Colors.textTertiary },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  primaryButtonText: { ...Typography.bodyBold, color: '#fff' },
});
