import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { GradientButton } from './GradientButton';
import { SafetyChecklistCard } from './SafetyChecklistCard';
import {
  checklistItemsFor,
  compositeCareService,
  SafetyChecklistAnswers,
  SafetyChecklistStatusOut,
} from '../services/composite-care.service';
import type { BookingStatus } from '../types';

interface Props {
  bookingId: string;
  status: BookingStatus;
}

const EMPTY: Partial<SafetyChecklistAnswers> = {};

const NOT_ELIGIBLE: BookingStatus[] = [
  'pending_payment',
  'confirmed',
  'prescription_pending',
  'searching_nurse',
  'completed',
  'cancelled',
  'missed',
];

/**
 * Mirrors the nurse's checklist screen (Step 4's "Safety Verification
 * Card"), for both guarded workflows — the questions differ between the
 * Composite Care Package and Service-Only flows, and the backend tells us
 * which set applies.
 *
 * Eligibility is decided by the API rather than by a prop: the status
 * endpoint 404s for bookings that aren't running a guarded workflow (and for
 * visits whose start-OTP handshake hasn't completed), which is exactly the
 * "render nothing" case. That keeps this safe to drop into the
 * booking-detail screen unconditionally.
 */
export const PatientSafetyVerification: React.FC<Props> = ({ bookingId, status }) => {
  const [checklistStatus, setChecklistStatus] = useState<SafetyChecklistStatusOut | null>(null);
  const [visible, setVisible] = useState(false);
  const [answers, setAnswers] = useState<Partial<SafetyChecklistAnswers>>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [discrepancy, setDiscrepancy] = useState<string[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const eligible = !NOT_ELIGIBLE.includes(status);

  const poll = useCallback(async () => {
    if (!eligible) return;
    try {
      const s = await compositeCareService.getChecklistStatus(bookingId);
      setChecklistStatus(s);
      setVisible(true);
      if (s.quality_discrepancy) setDiscrepancy((prev) => prev ?? []);
    } catch {
      // Visit hasn't started yet (start-OTP not verified), or this booking
      // isn't running a guarded workflow — nothing to show.
      setVisible(false);
    }
  }, [bookingId, eligible]);

  useEffect(() => {
    poll();
    if (!eligible) return undefined;
    pollRef.current = setInterval(poll, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll, eligible]);

  useEffect(() => {
    // Stop polling once both sides are in or the booking has moved past the
    // checklist gate entirely — nothing left that can change.
    if (checklistStatus?.both_submitted || status === 'in_progress' || status === 'completed') {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [checklistStatus?.both_submitted, status]);

  const submit = async () => {
    if (Object.keys(answers).length !== 5) return;
    setSubmitting(true);
    try {
      const s = await compositeCareService.submitPatientVerification(bookingId, answers as SafetyChecklistAnswers);
      setChecklistStatus(s);
    } catch (e: any) {
      const detail = e?.detail;
      if (detail?.code === 'QUALITY_DISCREPANCY_ALERT') {
        setDiscrepancy(detail.mismatched_items || []);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!eligible || !visible) return null;

  if (discrepancy) {
    return (
      <View style={[styles.card, styles.discCard]} testID="quality-discrepancy-banner">
        <Ionicons name="warning" size={22} color={Colors.error} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.discTitle}>We&apos;ve flagged this for a supervisor call</Text>
          <Text style={styles.discBody}>
            Your answers didn&apos;t match what the nurse reported. A supervisor will call you shortly,
            before the procedure continues.
          </Text>
        </View>
      </View>
    );
  }

  if (!checklistStatus?.nurse_checklist) {
    return (
      <View style={styles.card} testID="safety-waiting-nurse">
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.waitingTxt}>Waiting for your nurse to complete their safety checklist…</Text>
      </View>
    );
  }

  if (checklistStatus.supply_issue_reported) {
    return (
      <View style={[styles.card, styles.discCard]} testID="supply-issue-banner">
        <Ionicons name="alert-circle" size={22} color={Colors.error} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.discTitle}>Your nurse reported a problem with the supplies</Text>
          <Text style={styles.discBody}>
            The procedure is on hold while our team reviews this. Someone will contact you shortly.
          </Text>
        </View>
      </View>
    );
  }

  if (checklistStatus.both_submitted) {
    return (
      <View style={[styles.card, styles.doneCard]} testID="safety-verified">
        <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
        <Text style={styles.doneTxt}>Safety checklist confirmed by both you and your nurse.</Text>
      </View>
    );
  }

  const items = checklistItemsFor(checklistStatus.material_included);

  return (
    <View>
      <SafetyChecklistCard
        title="Safety verification"
        subtitle="Your nurse just completed their pre-procedure checklist. Please confirm independently and answer honestly — this helps us catch any missed step before the procedure starts."
        values={answers}
        items={items}
        onChange={(key, value) => setAnswers((s) => ({ ...s, [key]: value }))}
      />
      <GradientButton
        title={submitting ? 'Submitting…' : 'Confirm'}
        onPress={submit}
        loading={submitting}
        disabled={items.some((i) => answers[i.key] === undefined)}
        style={{ marginTop: Spacing.md }}
        testID="submit-patient-verification"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 10,
    ...Shadows.card,
  },
  waitingTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  doneCard: { backgroundColor: Colors.successBg },
  doneTxt: { ...Typography.small, color: Colors.success, fontWeight: '600' as const, flex: 1 },
  discCard: { backgroundColor: Colors.errorBg, alignItems: 'flex-start' },
  discTitle: { ...Typography.bodyBold, fontWeight: '700' as const, color: Colors.error },
  discBody: { ...Typography.small, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
