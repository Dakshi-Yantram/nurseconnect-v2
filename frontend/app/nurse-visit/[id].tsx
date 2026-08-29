/**
 * nurse-visit/[id].tsx — Nurse active visit screen with OTP start gate
 *
 * PATCH 4 — Mobile app (Expo / React Native)
 *
 * SAVE THIS FILE TO:
 *   frontend/app/nurse-visit/[id].tsx
 *
 * FIXED VERSION — aligned to the actual constants/theme.ts and Booking type
 * in this repo (no Spacing.sm/xl, no Radius.md, no Typography.body, no
 * Colors.border, and Booking uses careTitle/nurseName/address — not
 * service/patientName/nested address).
 *
 * WHAT IT DOES:
 *   This is the nurse's primary screen during an active assignment. It has
 *   three phases gated by visit state:
 *
 *   Phase 1 — OTP ENTRY (visit not started yet)
 *     The nurse arrived at the patient's home. The consumer generates a 4-digit
 *     code on their app (or receives it by SMS). The nurse types it here.
 *     On correct entry → POST /api/visits/{id}/verify-start-otp → visit starts.
 *
 *   Phase 2 — ACTIVE VISIT (in_progress)
 *     Quick-action panel: Vitals, Medications, Checklist, Escalate, End Visit.
 *     Each navigates to the relevant sub-screen.
 *
 *   Phase 3 — COMPLETED
 *     Shows checkout summary and prompts nurse to navigate to assignments.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Header } from '../../components/Header';
import { OTPInput } from '../../components/OTPInput';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { api } from '../../lib/api';
import { useStore } from '../../store';
import { callManager } from '../../lib/call-manager';
import { SUPPLY_CONFIRMATION_ITEMS } from '../../services/composite-care.service';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VisitRecord {
  id: string;
  booking_id: string;
  status: 'scheduled' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  check_in_at: string | null;
  check_out_at: string | null;
  family_summary: string | null;
  care_notes: string | null;
  actual_duration_minutes: number | null;
}

// ── Quick action definition ───────────────────────────────────────────────────
interface QuickAction {
  icon: string;
  label: string;
  color: string;
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'pulse-outline', label: 'Log Vitals', color: Colors.teal, route: 'vitals' },
  { icon: 'medical-outline', label: 'Medication', color: Colors.primary, route: 'medication' },
  { icon: 'checkbox-outline', label: 'Checklist', color: '#8B5CF6', route: 'checklist' },
  { icon: 'warning-outline', label: 'Escalate', color: Colors.error, route: 'escalation' },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NurseVisitScreen() {
  const router = useRouter();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();

  const [phase, setPhase] = useState<'loading' | 'otp' | 'active' | 'completed'>('loading');
  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Find the booking in the store for patient / service info.
  // NOTE: `nurseName` on a Booking is the assigned NURSE — the person being
  // cared for is `patientName`, which the backend populates on the booking
  // list/detail endpoints.
  const assignments = useStore((s) => s.assignments);
  const booking = assignments.find((a) => a.id === bookingId);

  // ── Load existing visit record ─────────────────────────────────────────────
  const loadVisit = useCallback(async () => {
    if (!bookingId) return;
    try {
      const record: VisitRecord = await api.get(`/visits/${bookingId}`);
      setVisit(record);
      if (record.status === 'completed') {
        setPhase('completed');
      } else if (record.check_in_at) {
        // Both guarded workflows have their own post-OTP flow
        // (synchronized safety checklist -> mandatory photos -> a second,
        // completion OTP) — hand off to that screen instead of the generic
        // quick-action panel below, which doesn't know about any of that.
        if (booking?.guardedWorkflow) {
          router.replace({ pathname: '/composite-visit/[id]', params: { id: bookingId! } });
          return;
        }
        setPhase('active');
      } else {
        setPhase('otp');
      }
    } catch (e: any) {
      // 404 means visit hasn't been created yet — that's fine, show OTP entry
      if (e?.status === 404 || e?.message?.includes('404')) {
        setPhase('otp');
      } else {
        setLoadError('Could not load visit details. Please try again.');
        setPhase('otp'); // still allow OTP entry
      }
    }
  }, [bookingId, booking?.guardedWorkflow, router]);

  useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  // ── OTP verification ───────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      setOtpError('Please enter the complete 4-digit code');
      return;
    }
    setOtpError('');
    setVerifying(true);

    // Get GPS coordinates — required by backend checkin
    let latitude = 0;
    let longitude = 0;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch {
      // GPS optional — send 0,0 if unavailable; backend records it
    }

    try {
      const record: VisitRecord = await api.post(`/visits/${bookingId}/verify-start-otp`, {
        otp: otp.trim(),
        latitude,
        longitude,
      });
      setVisit(record);
      // Refresh the assignment list so the dashboard and Visits tab reflect
      // the in-progress state rather than still showing "assigned".
      useStore.getState().refreshAssignmentsAPI().catch(() => { });
      if (booking?.guardedWorkflow) {
        router.replace({ pathname: '/composite-visit/[id]', params: { id: bookingId! } });
        return;
      }
      setPhase('active');
    } catch (e: any) {
      const code = e?.detail?.code || e?.code;
      if (code === 'OTP_INVALID') {
        const remaining = e?.detail?.attempts_remaining ?? '';
        setOtpError(
          `Incorrect code.${remaining ? ` ${remaining} attempt(s) remaining.` : ''}`
        );
      } else if (code === 'OTP_EXPIRED') {
        setOtpError('This code has expired. Ask the consumer to generate a new one.');
      } else if (code === 'OTP_MAX_ATTEMPTS_EXCEEDED') {
        setOtpError('Too many incorrect attempts. Ask the consumer to generate a new code.');
      } else {
        setOtpError(e?.message || 'Could not verify code. Please try again.');
      }
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  // ── Navigate to sub-screen ─────────────────────────────────────────────────
  const handleAction = (route: string) => {
    if (route === 'escalation') {
      router.push({ pathname: '/escalation/[id]', params: { id: bookingId! } });
    } else {
      // Navigate to the clinical sub-screens (vitals, medication, checklist)
      router.push({ pathname: '/clinical/[id]', params: { id: bookingId!, tab: route } });
    }
  };

  // ── Checkout ───────────────────────────────────────────────────────────────
  // IMPORTANT: this must NOT navigate straight to the "visit completed"
  // screen. Doing that used to skip vitals/documentation entirely and never
  // called the checkout API, so the visit stayed `in_progress` on the server
  // while the nurse app pretended it was done (and the family never saw a
  // report because `check_out_at` was never set). Checkout only happens
  // through /clinical/[id], which submits documentation and calls
  // completeVisitAPI → POST /visits/{id}/checkout, and the backend itself
  // will reject the checkout (MANDATORY_DOCUMENTATION_INCOMPLETE) if required
  // vitals/notes are missing.
  const handleEndVisit = () => {
    Alert.alert(
      'End visit',
      "You'll be taken to the visit documentation. Vitals and required notes must be submitted before the visit can be marked complete.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () =>
            router.push({ pathname: '/clinical/[id]', params: { id: bookingId! } }),
        },
      ]
    );
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Starting visit…" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: completed ──────────────────────────────────────────────────────
  if (phase === 'completed') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Visit complete" />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.teal} />
          <Text style={styles.completedTitle}>Visit completed</Text>
          <Text style={styles.completedSub}>
            {visit?.actual_duration_minutes
              ? `Duration: ${visit.actual_duration_minutes} minutes`
              : 'All done!'}
          </Text>

          {(!!visit?.family_summary || !!visit?.care_notes) && (
            <View style={[styles.bookingCard, { width: '100%', marginTop: Spacing.lg }]}>
              {!!visit?.family_summary && (
                <>
                  <Text style={styles.reportLabel}>Summary shared with family</Text>
                  <Text style={styles.reportBody}>{visit.family_summary}</Text>
                </>
              )}
              {!!visit?.care_notes && (
                <>
                  <Text style={[styles.reportLabel, { marginTop: Spacing.md }]}>Care notes</Text>
                  <Text style={styles.reportBody}>{visit.care_notes}</Text>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.doneBtn, { marginTop: Spacing.lg }]}
            onPress={() => router.replace('/(nurse)/assignments')}
          >
            <Text style={styles.doneBtnTxt}>Back to assignments</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: OTP entry ──────────────────────────────────────────────────────
  if (phase === 'otp') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Start visit" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.otpContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Booking info */}
            {booking && (
              <View style={styles.bookingCard}>
                <Text style={styles.bookingPatient}>{booking.patientName || 'Patient'}</Text>
                <Text style={styles.bookingService}>{booking.careTitle ?? ''}</Text>
                <Text style={styles.bookingAddress}>{booking.address ?? ''}</Text>
              </View>
            )}

            {/* Patient's own supplies (Workflow 2) — check BEFORE travelling,
                not after arriving, so a missing/expired item doesn't waste
                the trip. */}
            {booking?.serviceOnlyWorkflow && (
              <View style={styles.suppliesCard}>
                <View style={styles.suppliesHead}>
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                  <Text style={styles.suppliesTitle}>Patient's supplies</Text>
                </View>
                <Text style={styles.suppliesSub}>
                  The family uploaded this at booking. Check it matches what's needed before
                  you head out — you'll verify the physical items again on arrival.
                </Text>

                {booking.patientSupplyPhotoUrl ? (
                  <Image
                    source={{ uri: booking.patientSupplyPhotoUrl }}
                    style={styles.supplyPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.supplyPhotoMissing}>
                    <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                    <Text style={styles.supplyPhotoMissingTxt}>
                      No supply photo on file for this booking yet.
                    </Text>
                  </View>
                )}

                {!!booking.patientSupplyConfirmation && (
                  <View style={{ marginTop: Spacing.md }}>
                    {SUPPLY_CONFIRMATION_ITEMS.map((item) => {
                      const confirmed = booking.patientSupplyConfirmation?.[item.key] === true;
                      return (
                        <View key={item.key} style={styles.supplyItemRow}>
                          <Ionicons
                            name={confirmed ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={confirmed ? Colors.success : Colors.danger}
                          />
                          <Text style={styles.supplyItemTxt}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* OTP instruction */}
            <View style={styles.otpSection}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={32} color={Colors.teal} />
              </View>
              <Text style={styles.otpTitle}>Enter visit code</Text>
              <Text style={styles.otpSub}>
                Ask the consumer for the 4-digit code sent to their phone.
                Enter it below to start the visit.
              </Text>

              <View style={{ marginTop: Spacing.lg }}>
                <OTPInput value={otp} onChange={setOtp} length={4} testID="visit-otp-input" />
              </View>

              {otpError ? (
                <Text style={styles.otpErr}>{otpError}</Text>
              ) : null}

              {loadError ? (
                <Text style={styles.loadErr}>{loadError}</Text>
              ) : null}
            </View>

            <View style={styles.otpActions}>
              <GradientButton
                title={verifying ? 'Verifying…' : 'Start visit'}
                onPress={handleVerifyOtp}
                loading={verifying}
                testID="verify-otp-btn"
              />
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.backBtnTxt}>Back to assignments</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Render: active visit ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Active visit" />
      <ScrollView contentContainerStyle={styles.activeContainer}>

        {/* Status banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTxt}>Visit in progress</Text>
          {visit?.check_in_at && (
            <Text style={styles.statusTime}>
              Started {new Date(visit.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Patient info */}
        {booking && (
          <View style={styles.bookingCard}>
            <Text style={styles.bookingPatient}>{booking.patientName || 'Patient'}</Text>
            <Text style={styles.bookingService}>{booking.careTitle ?? ''}</Text>
            <Text style={styles.bookingAddress}>{booking.address ?? ''}</Text>
          </View>
        )}

        {/* Reach the family without leaving the visit */}
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() =>
            router.push({ pathname: '/chat/[bookingId]', params: { bookingId: bookingId! } })
          }
          testID="visit-message-family"
        >
          <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
          <Text style={styles.messageTxt}>Message the family</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* Voice call the family — same Dyte meeting the consumer app joins. */}
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() =>
            callManager.startCall(bookingId!, booking?.patientName || 'the family')
          }
          testID="visit-call-family"
        >
          <Ionicons name="call-outline" size={18} color={Colors.success} />
          <Text style={styles.messageTxt}>Call the family</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* Past visit history for this patient, recorded by any nurse */}
        {!!booking?.patientId && (
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={() =>
              router.push({ pathname: '/patient-history/[id]', params: { id: booking.patientId! } })
            }
            testID="visit-patient-history"
          >
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.messageTxt}>View patient history</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Clinical actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.route}
              style={[styles.actionCard, { borderColor: action.color + '33' }]}
              onPress={() => handleAction(action.route)}
              testID={`action-${action.route}`}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* End visit */}
        <TouchableOpacity style={styles.endBtn} onPress={handleEndVisit} testID="end-visit-btn">
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.endBtnTxt}>End visit & checkout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },

  // OTP phase
  otpContainer: { flexGrow: 1, padding: Spacing.lg, paddingBottom: 40 },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  bookingPatient: { ...Typography.h3, color: Colors.textPrimary },
  bookingService: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  bookingAddress: { ...Typography.small, color: Colors.textTertiary, marginTop: 4 },

  // Patient-supplied materials verification
  suppliesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  suppliesHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suppliesTitle: { ...Typography.h4, color: Colors.textPrimary },
  suppliesSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  supplyPhoto: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  supplyPhotoMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  supplyPhotoMissingTxt: { ...Typography.small, color: Colors.warning, flex: 1 },
  supplyItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  supplyItemTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },

  otpSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.teal + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  otpTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  otpSub: {
    ...Typography.bodyBold,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  otpErr: {
    ...Typography.small,
    color: Colors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  loadErr: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  otpActions: { marginTop: Spacing.lg, gap: Spacing.md },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  backBtnTxt: { ...Typography.small, color: Colors.textTertiary },

  // Active visit phase
  activeContainer: { padding: Spacing.lg, paddingBottom: 60 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.teal + '18',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.teal,
  },
  statusTxt: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.teal, flex: 1 },
  statusTime: { ...Typography.small, color: Colors.textTertiary },

  sectionLabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.card,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...Typography.small, fontWeight: '600' as const, textAlign: 'center' },

  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  messageTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.error + '12',
    borderWidth: 1.5,
    borderColor: Colors.error + '33',
  },
  endBtnTxt: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.error },

  // Completed phase
  completedTitle: { ...Typography.h2, color: Colors.textPrimary, marginTop: Spacing.lg },
  completedSub: { ...Typography.bodyBold, fontWeight: '400' as const, color: Colors.textSecondary, marginTop: Spacing.md },
  doneBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  reportLabel: { ...Typography.small, color: Colors.textTertiary },
  reportBody: { ...Typography.body, color: Colors.textPrimary, marginTop: 4, lineHeight: 21 },
  doneBtnTxt: { ...Typography.bodyBold, color: '#fff', fontWeight: '700' as const },
});