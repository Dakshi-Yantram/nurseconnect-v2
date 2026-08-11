/**
 * composite-visit/[id].tsx — Nurse flow for Workflow 1 (Composite Care
 * Package) bookings, Steps 4–7 of the spec.
 *
 * nurse-visit/[id].tsx redirects here the moment the start-OTP handshake
 * succeeds on a `material_included` booking, since the generic quick-action
 * screen doesn't have the synchronized checklist / mandatory photo / second
 * OTP gates this workflow requires.
 *
 * Step derivation is driven by `booking.rawStatus` (refreshed from the
 * server) rather than local-only state, so resuming the app mid-flow lands
 * on the right screen:
 *   assigned                  -> checklist (or straight to pre-photo if the
 *                                 GET status shows both sides already done)
 *   quality_discrepancy_alert -> blocked, supervisor review
 *   in_progress               -> vitals + post-photo + completion OTP
 *   completed                 -> invoice summary
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OTPInput } from '../../components/OTPInput';
import { SafetyChecklistCard } from '../../components/SafetyChecklistCard';
import { PhotoCapture } from '../../components/PhotoCapture';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { visitsService } from '../../services/visits.service';
import {
  compositeCareService,
  SafetyChecklistAnswers,
  SafetyChecklistStatusOut,
} from '../../services/composite-care.service';

type Step =
  | 'loading'
  | 'checklist'
  | 'waiting_patient'
  | 'discrepancy'
  | 'pre_photo'
  | 'in_progress'
  | 'post_photo'
  | 'completion_otp'
  | 'done'
  | 'error';

const EMPTY_ANSWERS: Partial<SafetyChecklistAnswers> = {};

export default function CompositeVisitScreen() {
  const router = useRouter();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();

  const assignments = useStore((s) => s.assignments);
  const refreshAssignmentsAPI = useStore((s) => s.refreshAssignmentsAPI);
  const booking = assignments.find((a) => a.id === bookingId);

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Checklist
  const [nurseAnswers, setNurseAnswers] = useState<Partial<SafetyChecklistAnswers>>(EMPTY_ANSWERS);
  const [checklistStatus, setChecklistStatus] = useState<SafetyChecklistStatusOut | null>(null);
  const [submittingChecklist, setSubmittingChecklist] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Photos
  const [prePhotoBase64, setPrePhotoBase64] = useState<string | null>(null);
  const [prePhotoSubmitting, setPrePhotoSubmitting] = useState(false);
  const [postPhotoBase64, setPostPhotoBase64] = useState<string | null>(null);
  const [postPhotoSubmitted, setPostPhotoSubmitted] = useState(false);
  const [postPhotoSubmitting, setPostPhotoSubmitting] = useState(false);

  // Vitals (minimal — full documentation still lives in /clinical/[id] if
  // the nurse wants to log more; these three are enough to clear the
  // mandatory-documentation gate on checkout for most packages).
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [pulse, setPulse] = useState('');
  const [spo2, setSpo2] = useState('');
  const [vitalsSaved, setVitalsSaved] = useState(false);
  const [vitalsSaving, setVitalsSaving] = useState(false);

  // Completion OTP
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [invoice, setInvoice] = useState<{
    invoice_number: string;
    total_amount: string;
    gst_percent: string;
  } | null>(null);

  const getLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch {
      // GPS optional — backend still records the metadata overlay with 0,0.
    }
    return { latitude: 0, longitude: 0 };
  };

  // ── Derive the current step from the booking status on load / refresh ──
  const deriveStep = useCallback(async () => {
    if (!bookingId) return;
    try {
      await refreshAssignmentsAPI();
    } catch {
      // fall through — use whatever we already have in the store
    }
    const b = useStore.getState().assignments.find((a) => a.id === bookingId);
    if (!b) {
      setErrorMsg('Could not load this visit.');
      setStep('error');
      return;
    }
    if (b.rawStatus === 'quality_discrepancy_alert') {
      setStep('discrepancy');
      return;
    }
    if (b.rawStatus === 'in_progress') {
      setStep('in_progress');
      return;
    }
    if (b.rawStatus === 'completed') {
      try {
        const inv = await compositeCareService.getInvoice(bookingId);
        setInvoice(inv as any);
      } catch {
        // ok — still show the done screen without invoice numbers
      }
      setStep('done');
      return;
    }
    // Otherwise the nurse checklist gate is still open — check whether it's
    // already been (partially) submitted so the app resumes correctly.
    try {
      const status = await compositeCareService.getChecklistStatus(bookingId);
      setChecklistStatus(status);
      if (status.quality_discrepancy) {
        setStep('discrepancy');
      } else if (status.both_submitted) {
        setStep('pre_photo');
      } else if (status.nurse_checklist) {
        setStep('waiting_patient');
      } else {
        setStep('checklist');
      }
    } catch {
      setStep('checklist');
    }
  }, [bookingId, refreshAssignmentsAPI]);

  useEffect(() => {
    deriveStep();
  }, [deriveStep]);

  // ── Poll for the patient's side while waiting ───────────────────────────
  useEffect(() => {
    if (step !== 'waiting_patient' || !bookingId) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const status = await compositeCareService.getChecklistStatus(bookingId);
        setChecklistStatus(status);
        if (status.quality_discrepancy) {
          setStep('discrepancy');
        } else if (status.both_submitted) {
          setStep('pre_photo');
        }
      } catch {
        // keep polling silently
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, bookingId]);

  // ── Step 4: nurse submits checklist ─────────────────────────────────────
  const allAnswered = Object.keys(nurseAnswers).length === 5;

  const submitChecklist = async () => {
    if (!bookingId || !allAnswered) return;
    setSubmittingChecklist(true);
    try {
      const status = await compositeCareService.submitNurseChecklist(bookingId, {
        ...(nurseAnswers as SafetyChecklistAnswers),
      });
      setChecklistStatus(status);
      setStep(status.both_submitted ? 'pre_photo' : 'waiting_patient');
    } catch (e: any) {
      Alert.alert('Could not submit checklist', e?.message || 'Please try again.');
    } finally {
      setSubmittingChecklist(false);
    }
  };

  // ── Step 5: pre-procedure photo ─────────────────────────────────────────
  const submitPrePhoto = async (base64: string) => {
    if (!bookingId) return;
    setPrePhotoBase64(base64);
    setPrePhotoSubmitting(true);
    try {
      const { latitude, longitude } = await getLocation();
      await compositeCareService.submitPreProcedurePhoto(bookingId, {
        photo_base64: base64,
        latitude,
        longitude,
      });
      await refreshAssignmentsAPI().catch(() => {});
      setStep('in_progress');
    } catch (e: any) {
      const code = e?.detail?.code || e?.code;
      if (code === 'QUALITY_DISCREPANCY_ALERT') {
        setStep('discrepancy');
      } else {
        Alert.alert('Could not submit photo', e?.message || 'Please try again.');
        setPrePhotoBase64(null);
      }
    } finally {
      setPrePhotoSubmitting(false);
    }
  };

  // ── In-progress: quick vitals ───────────────────────────────────────────
  const saveVitals = async () => {
    if (!bookingId) return;
    if (!bpSys || !bpDia || !pulse || !spo2) {
      Alert.alert('Missing vitals', 'Please fill in BP, pulse and SpO2 before continuing.');
      return;
    }
    setVitalsSaving(true);
    try {
      await visitsService.submitVitals(bookingId, {
        bp_systolic: Number(bpSys),
        bp_diastolic: Number(bpDia),
        pulse: Number(pulse),
        spo2: Number(spo2),
      });
      setVitalsSaved(true);
    } catch (e: any) {
      Alert.alert('Could not save vitals', e?.message || 'Please try again.');
    } finally {
      setVitalsSaving(false);
    }
  };

  // ── Step 6: post-procedure photo ────────────────────────────────────────
  const submitPostPhoto = async (base64: string) => {
    if (!bookingId) return;
    setPostPhotoBase64(base64);
    setPostPhotoSubmitting(true);
    try {
      const { latitude, longitude } = await getLocation();
      await compositeCareService.submitPostProcedurePhoto(bookingId, {
        photo_base64: base64,
        latitude,
        longitude,
      });
      setPostPhotoSubmitted(true);
      setStep('completion_otp');
    } catch (e: any) {
      Alert.alert('Could not submit photo', e?.message || 'Please try again.');
      setPostPhotoBase64(null);
    } finally {
      setPostPhotoSubmitting(false);
    }
  };

  // ── Step 6/7: completion OTP -> checkout + invoice ──────────────────────
  const verifyCompletionOtp = async () => {
    if (!bookingId) return;
    if (otp.length < 4) {
      setOtpError('Please enter the complete 4-digit code');
      return;
    }
    setOtpError('');
    setVerifyingOtp(true);
    try {
      const { latitude, longitude } = await getLocation();
      const result = await compositeCareService.verifyCompletionOtp(bookingId, {
        otp: otp.trim(),
        latitude,
        longitude,
      });
      setInvoice(result.invoice as any);
      await refreshAssignmentsAPI().catch(() => {});
      setStep('done');
    } catch (e: any) {
      const code = e?.detail?.code || e?.code;
      if (code === 'OTP_INVALID') {
        setOtpError(e?.detail?.message || 'Incorrect completion code.');
      } else if (code === 'OTP_EXPIRED') {
        setOtpError('This code has expired. Ask the patient/family to generate a new one.');
      } else if (code === 'OTP_MAX_ATTEMPTS_EXCEEDED') {
        setOtpError('Too many incorrect attempts. Ask for a new completion code.');
      } else if (code === 'MANDATORY_DOCUMENTATION_INCOMPLETE') {
        setOtpError('');
        Alert.alert(
          'Documentation incomplete',
          e?.detail?.message ||
            'Some required documentation is missing. Please log vitals / notes before closing the visit.',
        );
      } else {
        setOtpError(e?.message || 'Could not verify code. Please try again.');
      }
      setOtp('');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Composite care visit" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Composite care visit" />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errTxt}>{errorMsg}</Text>
          <GradientButton title="Try again" variant="outline" fullWidth={false} onPress={deriveStep} style={{ marginTop: Spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'discrepancy') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Flagged for review" />
        <View style={styles.center}>
          <Ionicons name="warning" size={56} color={Colors.error} />
          <Text style={styles.discTitle}>Quality discrepancy flagged</Text>
          <Text style={styles.discBody}>
            The patient/family's safety-check answers didn't match yours. This booking has been
            sent to Ops for a supervisor review call — please pause the procedure and wait to be
            contacted before proceeding.
          </Text>
          <GradientButton
            title="Contact support"
            onPress={() => router.push('/support/raise')}
            style={{ marginTop: Spacing.lg }}
          />
          <TouchableOpacity onPress={() => router.replace('/(nurse)/assignments' as any)} style={{ marginTop: Spacing.md }}>
            <Text style={styles.backTxt}>Back to assignments</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Visit complete" />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.teal} />
          <Text style={styles.completedTitle}>Visit completed</Text>
          {invoice ? (
            <View style={styles.invoiceCard}>
              <Text style={styles.invoiceLabel}>Composite Healthcare Service Invoice</Text>
              <Text style={styles.invoiceNo}>{invoice.invoice_number}</Text>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceRowLabel}>GST</Text>
                <Text style={styles.invoiceRowVal}>{invoice.gst_percent}%</Text>
              </View>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceRowLabel}>Total</Text>
                <Text style={styles.invoiceTotal}>₹{invoice.total_amount}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.completedSub}>Invoice generated.</Text>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(nurse)/assignments' as any)}>
            <Text style={styles.doneBtnTxt}>Back to assignments</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'checklist' || step === 'waiting_patient') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Safety checklist" />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          {booking && (
            <View style={styles.bookingCard}>
              <Text style={styles.bookingPatient}>{booking.patientName || 'Patient'}</Text>
              <Text style={styles.bookingService}>{booking.careTitle ?? ''}</Text>
            </View>
          )}

          <SafetyChecklistCard
            title="Pre-procedure clinical & intake questionnaire"
            subtitle="Complete every item honestly — the patient/family answers the same five questions independently on their app, and mismatches are flagged for supervisor review."
            values={nurseAnswers}
            onChange={(key, value) => setNurseAnswers((s) => ({ ...s, [key]: value }))}
            readOnly={step === 'waiting_patient'}
          />

          {step === 'checklist' ? (
            <GradientButton
              title={submittingChecklist ? 'Submitting…' : 'Submit checklist'}
              onPress={submitChecklist}
              loading={submittingChecklist}
              disabled={!allAnswered}
              style={{ marginTop: Spacing.lg }}
              testID="submit-nurse-checklist"
            />
          ) : (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.waitingTxt}>
                Waiting for the patient/family to confirm on their app…
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'pre_photo') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Pre-procedure photo" />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <Text style={styles.stepTitle}>Both checklists match ✓</Text>
          <Text style={styles.stepSub}>
            Take one live photo showing the sealed, unopened procedure kit together with the
            doctor's prescription. This unlocks the procedure.
          </Text>
          <View style={{ marginTop: Spacing.lg }}>
            <PhotoCapture
              title="Kit + prescription photo"
              hint="Sealed kit and Rx clearly visible, in frame together"
              onCaptured={(base64) => submitPrePhoto(base64)}
              submitted={!!prePhotoBase64 && !prePhotoSubmitting}
              disabled={prePhotoSubmitting}
              testID="pre-procedure-photo"
            />
            {prePhotoSubmitting && (
              <View style={styles.waitingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.waitingTxt}>Uploading…</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'in_progress') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Procedure in progress" />
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <View style={styles.statusBanner}>
            <View style={styles.statusDot} />
            <Text style={styles.statusTxt}>Procedure in progress</Text>
          </View>

          <Text style={styles.sectionLabel}>Vitals</Text>
          <View style={styles.vitalsRow}>
            <VitalInput label="BP Sys" value={bpSys} onChangeText={setBpSys} />
            <VitalInput label="BP Dia" value={bpDia} onChangeText={setBpDia} />
            <VitalInput label="Pulse" value={pulse} onChangeText={setPulse} />
            <VitalInput label="SpO2" value={spo2} onChangeText={setSpo2} />
          </View>
          <GradientButton
            title={vitalsSaved ? 'Vitals saved ✓' : vitalsSaving ? 'Saving…' : 'Save vitals'}
            variant={vitalsSaved ? 'outline' : 'primary'}
            onPress={saveVitals}
            loading={vitalsSaving}
            disabled={vitalsSaved}
            style={{ marginTop: Spacing.sm }}
            testID="save-vitals"
          />

          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Close out the visit</Text>
          <PhotoCapture
            title="Post-procedure photo"
            hint="Live photo of the dressed / completed site"
            onCaptured={(base64) => submitPostPhoto(base64)}
            submitted={postPhotoSubmitted}
            disabled={postPhotoSubmitting}
            testID="post-procedure-photo"
          />
          {postPhotoSubmitting && (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.waitingTxt}>Uploading…</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // step === 'completion_otp'
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Enter completion code" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <View style={styles.otpSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-done-outline" size={32} color={Colors.teal} />
          </View>
          <Text style={styles.otpTitle}>Enter completion code</Text>
          <Text style={styles.otpSub}>
            Ask the patient/family to generate their completion code and read it out to close the
            visit and generate the invoice.
          </Text>
          <View style={{ marginTop: Spacing.lg }}>
            <OTPInput value={otp} onChange={setOtp} length={4} testID="completion-otp-input" />
          </View>
          {otpError ? <Text style={styles.otpErr}>{otpError}</Text> : null}
        </View>
        <GradientButton
          title={verifyingOtp ? 'Verifying…' : 'Complete visit'}
          onPress={verifyCompletionOtp}
          loading={verifyingOtp}
          style={{ marginTop: Spacing.lg }}
          testID="verify-completion-otp"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const VitalInput: React.FC<{ label: string; value: string; onChangeText: (v: string) => void }> = ({
  label,
  value,
  onChangeText,
}) => (
  <View style={styles.vitalBox}>
    <Text style={styles.vitalLabel}>{label}</Text>
    <TextInput
      style={styles.vitalInput}
      keyboardType="number-pad"
      value={value}
      onChangeText={onChangeText}
      placeholder="—"
      placeholderTextColor={Colors.textTertiary}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errTxt: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md },

  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  bookingPatient: { ...Typography.h3, color: Colors.textPrimary },
  bookingService: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },

  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.lg, justifyContent: 'center' },
  waitingTxt: { ...Typography.small, color: Colors.textSecondary },

  stepTitle: { ...Typography.h3, color: Colors.textPrimary },
  stepSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 6, lineHeight: 19 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.teal + '18',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal },
  statusTxt: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.teal, flex: 1 },

  sectionLabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  vitalsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  vitalBox: { flex: 1 },
  vitalLabel: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 4 },
  vitalInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 10,
    textAlign: 'center',
    color: Colors.textPrimary,
    ...Typography.body,
  },

  discTitle: { ...Typography.h2, color: Colors.textPrimary, marginTop: Spacing.lg, textAlign: 'center' },
  discBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 22 },
  backTxt: { ...Typography.small, color: Colors.textTertiary },

  completedTitle: { ...Typography.h2, color: Colors.textPrimary, marginTop: Spacing.lg },
  completedSub: { ...Typography.bodyBold, fontWeight: '400' as const, color: Colors.textSecondary, marginTop: Spacing.md },
  invoiceCard: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    ...Shadows.card,
  },
  invoiceLabel: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase' },
  invoiceNo: { ...Typography.h3, color: Colors.textPrimary, marginTop: 4 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  invoiceRowLabel: { ...Typography.small, color: Colors.textSecondary },
  invoiceRowVal: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  invoiceTotal: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const },
  doneBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  doneBtnTxt: { ...Typography.bodyBold, color: '#fff', fontWeight: '700' as const },

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
  otpErr: { ...Typography.small, color: Colors.error, marginTop: Spacing.md, textAlign: 'center' },
});
