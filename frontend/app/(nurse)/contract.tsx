/**
 * Provider contract screen — Stage 1 in-app clickwrap (checkbox + OTP) and
 * Stage 2 Master Agreement (unlocked after first completed booking,
 * executed via real Aadhaar eSign through Digio).
 *
 * All contract text is rendered server-side per provider type — this
 * screen never hardcodes wording, name, or registration number. It just
 * displays whatever GET /contracts/me returns and posts the accept action.
 *
 * Stage 2 flow (see services/contracts.service.ts for the full contract):
 *   1. initiateStage2Esign() — server renders + uploads the agreement to
 *      Digio, returns Digio's own sign_url.
 *   2. Real sign_url  -> open it in an in-app browser (expo-web-browser),
 *      watch for it returning to our redirect scheme.
 *      Mock sign_url  -> MOCK_EXTERNAL_PROVIDERS is on and there is no real
 *      Digio sandbox to redirect to; render this screen's own mock signing
 *      modal instead, so the whole flow — initiate, "sign", status check,
 *      finalize — is still exercised end-to-end.
 *   3. Poll getStage2EsignStatus() until the SERVER (not this screen) says
 *      "signed" — nothing this screen does can mark it signed by itself.
 *   4. acceptStage2() with no esign fields — it finalizes purely from the
 *      server's own session record.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import {
  contractsService,
  ContractPreview,
  EsignStatusResult,
} from '../../services/contracts.service';

// Must match the backend's DIGIO_REDIRECT_URL (app/core/config.py). Digio's
// hosted signing page redirects the in-app browser here once the signer
// finishes or abandons; expo-web-browser watches for navigation to this
// scheme to know the session ended and hand control back to this screen.
const ESIGN_REDIRECT_URL = 'nurseconnect://esign-complete';
const MOCK_SIGN_URL_PREFIX = 'nurseconnect-mock://digio-sign/';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 12; // ~30s of automatic polling before falling back to manual retry

type EsignPhase =
  | 'idle'            // nothing started yet
  | 'starting'        // initiate() in flight
  | 'awaiting_signer' // browser/mock modal open, or just closed and about to poll
  | 'confirming'      // polling the server for the outcome
  | 'stuck'           // polling exhausted without a terminal status — offer manual retry
  | 'failed'          // server confirmed signing failed/expired
  | 'finalizing';     // acceptStage2() in flight after status == 'signed'

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

  // --- Stage 2 e-Sign state ---
  const [esignPhase, setEsignPhase] = useState<EsignPhase>('idle');
  const [esignFailureReason, setEsignFailureReason] = useState<string | null>(null);
  const [mockModalVisible, setMockModalVisible] = useState(false);
  const [mockSubmitting, setMockSubmitting] = useState(false);
  const pollAttempts = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

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

  // ── Stage 2 — finalize once the server confirms "signed" ─────────────────
  const finalizeStage2 = useCallback(async () => {
    setEsignPhase('finalizing');
    try {
      await contractsService.acceptStage2({});
      clearPoll();
      setEsignPhase('idle');
      Alert.alert('Master Agreement executed', 'You can now accept your next booking.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      load();
    } catch (e: any) {
      setEsignPhase('failed');
      setEsignFailureReason(
        e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? e?.message ?? 'Please try again.',
      );
    }
  }, [clearPoll, load, router]);

  // ── Stage 2 — poll the server for the outcome ─────────────────────────────
  // Never resolves "signed" from anything client-side; every poll asks the
  // server, which itself re-checks with Digio if a webhook hasn't landed.
  const pollEsignStatus = useCallback(
    async (attempt = 0) => {
      let status: EsignStatusResult;
      try {
        status = await contractsService.getStage2EsignStatus();
      } catch (e: any) {
        setEsignPhase('stuck');
        return;
      }

      if (status.status === 'signed') {
        await finalizeStage2();
        return;
      }
      if (status.status === 'failed') {
        setEsignPhase('failed');
        setEsignFailureReason(status.failure_reason ?? 'Signing was not completed.');
        return;
      }

      // Still created/sent — Digio (or the webhook) hasn't confirmed yet.
      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setEsignPhase('stuck');
        return;
      }
      setEsignPhase('confirming');
      pollTimer.current = setTimeout(() => pollEsignStatus(attempt + 1), POLL_INTERVAL_MS);
    },
    [finalizeStage2],
  );

  // ── Stage 2 — start a session ──────────────────────────────────────────
  const handleStartStage2Esign = () => {
    Alert.alert(
      'e-Sign required',
      'This will open Aadhaar eSign on state e-Stamp paper via Digio. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: beginEsignSession },
      ],
    );
  };

  const beginEsignSession = async () => {
    setEsignPhase('starting');
    pollAttempts.current = 0;
    try {
      const res = await contractsService.initiateStage2Esign();

      if (res.status === 'signed') {
        // Session was already signed (e.g. re-opening the screen after the
        // webhook landed while the app was backgrounded) — finalize right away.
        await finalizeStage2();
        return;
      }

      if (!res.sign_url) {
        setEsignPhase('stuck');
        return;
      }

      if (res.sign_url.startsWith(MOCK_SIGN_URL_PREFIX)) {
        // No real Digio sandbox to redirect to — render our own in-app mock
        // signing screen. The backend only accepts a "signed" outcome from
        // this path via mock-complete, and that endpoint 403s outside
        // MOCK_EXTERNAL_PROVIDERS, so this can never bypass real signing in
        // production regardless of what this screen does.
        setEsignPhase('awaiting_signer');
        setMockModalVisible(true);
        return;
      }

      // Real Digio sign_url — open it in an in-app browser and watch for it
      // returning to our redirect scheme.
      setEsignPhase('awaiting_signer');
      await WebBrowser.openAuthSessionAsync(res.sign_url, ESIGN_REDIRECT_URL);
      // Whatever the browser session resolved with (success, dismiss, or the
      // user just closing it), the only thing that matters is what the
      // server says happened — so unconditionally start confirming.
      pollEsignStatus(0);
    } catch (e: any) {
      setEsignPhase('failed');
      setEsignFailureReason(e?.response?.data?.detail ?? e?.message ?? 'Could not start e-Sign.');
    }
  };

  const handleMockSign = async () => {
    setMockSubmitting(true);
    try {
      await contractsService.mockCompleteStage2Esign();
      setMockModalVisible(false);
      pollEsignStatus(0);
    } catch (e: any) {
      Alert.alert('Could not simulate signing', e?.message ?? 'Please try again.');
    } finally {
      setMockSubmitting(false);
    }
  };

  const handleMockCancel = () => {
    setMockModalVisible(false);
    setEsignPhase('idle');
  };

  const handleRetryStage2 = () => {
    clearPoll();
    setEsignFailureReason(null);
    setEsignPhase('idle');
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
                  {__DEV__ && devOtp ? <Text style={styles.devOtpHint}>Dev OTP: {devOtp}</Text> : null}
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
              {esignPhase === 'idle' && (
                <TouchableOpacity style={styles.primaryButton} onPress={handleStartStage2Esign}>
                  <Text style={styles.primaryButtonText}>Execute via Aadhaar eSign</Text>
                </TouchableOpacity>
              )}

              {esignPhase === 'starting' && (
                <View style={styles.esignStatusBox}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.esignStatusText}>Preparing your agreement for signing…</Text>
                </View>
              )}

              {esignPhase === 'awaiting_signer' && !mockModalVisible && (
                <View style={styles.esignStatusBox}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.esignStatusText}>Waiting for the Aadhaar eSign session to complete…</Text>
                </View>
              )}

              {esignPhase === 'confirming' && (
                <View style={styles.esignStatusBox}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.esignStatusText}>
                    Confirming your signature with Digio… this can take a few moments.
                  </Text>
                </View>
              )}

              {esignPhase === 'finalizing' && (
                <View style={styles.esignStatusBox}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.esignStatusText}>Finalizing your Master Agreement…</Text>
                </View>
              )}

              {esignPhase === 'stuck' && (
                <View style={styles.esignStatusBox}>
                  <Ionicons name="time-outline" size={22} color={Colors.textSecondary} />
                  <Text style={styles.esignStatusText}>
                    We haven't heard back from Digio yet. This sometimes just takes a little
                    longer — check again, or come back later; your session is still open.
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: Spacing.sm }]}
                    onPress={() => pollEsignStatus(0)}
                  >
                    <Text style={styles.primaryButtonText}>Check again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {esignPhase === 'failed' && (
                <View style={styles.esignStatusBox}>
                  <Ionicons name="alert-circle-outline" size={22} color={Colors.error} />
                  <Text style={styles.esignStatusText}>
                    {esignFailureReason ?? 'e-Sign could not be completed.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: Spacing.sm }]}
                    onPress={handleRetryStage2}
                  >
                    <Text style={styles.primaryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Mock signing modal — only ever shown when the backend returned a
          nurseconnect-mock:// sign_url, which only happens when
          MOCK_EXTERNAL_PROVIDERS is on server-side. */}
      <Modal visible={mockModalVisible} transparent animationType="fade" onRequestClose={handleMockCancel}>
        <View style={styles.mockOverlay}>
          <View style={styles.mockCard}>
            <Ionicons name="finger-print-outline" size={36} color={Colors.primary} />
            <Text style={styles.mockTitle}>Mock Aadhaar eSign</Text>
            <Text style={styles.mockBody}>
              No live Digio sandbox is configured for this environment. This screen stands in
              for Digio's hosted signing page so the rest of the flow — status confirmation and
              finalizing your agreement — runs exactly as it will in production.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleMockSign} disabled={mockSubmitting}>
              {mockSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Simulate: I have signed</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.mockCancelButton} onPress={handleMockCancel} disabled={mockSubmitting}>
              <Text style={styles.mockCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  esignStatusBox: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.card,
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  esignStatusText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  mockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  mockCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: Spacing.card,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.card,
  },
  mockTitle: { ...Typography.h3, color: Colors.textPrimary },
  mockBody: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center' },
  mockCancelButton: { paddingVertical: Spacing.xs },
  mockCancelText: { ...Typography.body, color: Colors.textTertiary },
});
