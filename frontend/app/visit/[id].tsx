/**
 * visit/[id].tsx — Consumer active visit detail screen
 *
 * PATCH 4 — Mobile app (Expo / React Native)
 *
 * SAVE THIS FILE TO:
 *   frontend/app/visit/[id].tsx
 *
 * FIXED VERSION — aligned to the actual constants/theme.ts in this repo:
 *   - No Spacing.sm / Spacing.xl  → using Spacing.md / Spacing.lg only
 *   - No Radius.md                → using Radius.lg
 *   - No Typography.body          → using Typography.bodyBold (weight overridden where needed)
 *   - No Colors.border            → using Colors.divider
 *
 * WHAT IT DOES:
 *   The consumer's view of an active or upcoming booking. Phases:
 *
 *   Phase 1 — UPCOMING / NURSE ASSIGNED
 *     Shows booking details, nurse name, scheduled time.
 *     "Generate visit code" button appears once nurse is assigned (status=active/claimed).
 *     On tap → POST /api/visits/{id}/generate-start-otp → 4-digit code shown on screen.
 *     The code is also SMSed to the consumer's phone.
 *
 *   Phase 2 — IN PROGRESS
 *     Shows live status, nurse name, started time.
 *     Links to live tracking screen.
 *
 *   Phase 3 — COMPLETED
 *     Shows family summary, duration, and prompts for rating.
 *     Links to visit-success screen for full post-visit summary.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { api } from '../../lib/api';
import { useStore } from '../../store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VisitRecord {
  id: string;
  booking_id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  family_summary: string | null;
  actual_duration_minutes: number | null;
  rating_by_consumer: number | null;
}

interface BookingDetail {
  id: string;
  booking_ref: string;
  status: string;
  worker_id: string | null;
  scheduled_date: string;
  scheduled_start_time: string;
  address_snapshot: { line1?: string; city?: string };
  total_amount: number;
}

// ── OTP states ────────────────────────────────────────────────────────────────
type OtpState = 'idle' | 'loading' | 'active' | 'expired';

// ── Main screen ───────────────────────────────────────────────────────────────
export default function VisitDetailScreen() {
  const router = useRouter();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // OTP state
  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [displayOtp, setDisplayOtp] = useState('');  // shown on screen if SMS fails
  const [otpSmsConfirmed, setOtpSmsConfirmed] = useState(false);

  // NOTE: store Booking type (from ../types) uses careTitle / nurseName /
  // address (flat string) — not service / patientName / nested address.
  // storeBooking is kept only as a UI fallback while the backend BookingDetail
  // (fetched via api.get below) loads.
  const bookings = useStore((s) => s.bookings);
  const storeBooking = bookings.find((b) => b.id === bookingId);

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      const [bRes, vRes] = await Promise.allSettled([
        api.get(`/bookings/${bookingId}`),
        api.get(`/visits/${bookingId}`),
      ]);
      if (bRes.status === 'fulfilled') setBooking(bRes.value);
      if (vRes.status === 'fulfilled') setVisit(vRes.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // OTP countdown
  useEffect(() => {
    if (otpState !== 'active' || secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setOtpState('expired'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [otpState, secondsLeft]);

  // Poll for visit start when OTP is active
  useEffect(() => {
    if (otpState !== 'active') return;
    const interval = setInterval(async () => {
      try {
        const v: VisitRecord = await api.get(`/visits/${bookingId}`);
        if (v.check_in_at) {
          setVisit(v);
          setOtpState('idle');
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, [otpState, bookingId]);

  // ── Generate OTP ───────────────────────────────────────────────────────────
  const handleGenerateOtp = async () => {
    setOtpState('loading');
    try {
      const res = await api.post(`/visits/${bookingId}/generate-start-otp`, {});
      setOtpState('active');
      setSecondsLeft(res.expires_in_seconds ?? 600);
      setOtpSmsConfirmed(res.sms_sent ?? false);
      // If backend returns _dev_otp (dev mode only), show it on screen
      if (res._dev_otp) setDisplayOtp(res._dev_otp);
    } catch (e: any) {
      setOtpState('idle');
      Alert.alert('Could not generate code', e?.message || 'Please try again.');
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const status = booking?.status ?? storeBooking?.status ?? '';
  const isActive = status === 'active' || status === 'claimed' || status === 'in_progress';
  const isInProgress = visit?.check_in_at != null || status === 'in_progress';
  const isCompleted = status === 'completed' || visit?.check_out_at != null;
  const nurseAssigned = !!booking?.worker_id;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Visit detail" />
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.teal} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Visit detail" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.teal} />}
      >

        {/* Booking summary card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardLabel}>
              {booking?.scheduled_date} at {booking?.scheduled_start_time?.slice(0, 5)}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: Spacing.md }]}>
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardLabel}>
              {booking?.address_snapshot?.line1}, {booking?.address_snapshot?.city}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: Spacing.md }]}>
            <Ionicons name="receipt-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardLabel}>
              Ref: {booking?.booking_ref} · ₹{Number(booking?.total_amount ?? 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Status section */}
        <StatusBadge status={status} inProgress={isInProgress} isCompleted={isCompleted} />

        {/* ── IN PROGRESS: tracking link ─────────────────────────────────── */}
        {isInProgress && !isCompleted && (
          <TouchableOpacity
            style={styles.trackingBtn}
            onPress={() => router.push({ pathname: '/tracking/[id]', params: { id: bookingId! } })}
          >
            <Ionicons name="navigate-outline" size={18} color={Colors.teal} />
            <Text style={styles.trackingBtnTxt}>Live tracking</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.teal} />
          </TouchableOpacity>
        )}

        {/* ── COMPLETED: summary ─────────────────────────────────────────── */}
        {isCompleted && (
          <>
            {visit?.family_summary ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Care summary</Text>
                <Text style={styles.summaryTxt}>{visit.family_summary}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.summaryBtn}
              onPress={() => router.push({ pathname: '/visit-success/[id]', params: { id: bookingId! } })}
            >
              <Text style={styles.summaryBtnTxt}>View full summary & rate</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </>
        )}

        {/* ── OTP SECTION — only when nurse assigned and visit not started ─ */}
        {isActive && nurseAssigned && !isInProgress && !isCompleted && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <View style={styles.otpIconCircle}>
                <Ionicons name="shield-checkmark-outline" size={24} color={Colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.otpTitle}>Start visit verification</Text>
                <Text style={styles.otpSub}>
                  When your nurse arrives, generate a code and share it with them.
                </Text>
              </View>
            </View>

            {otpState === 'idle' && (
              <TouchableOpacity style={styles.genBtn} onPress={handleGenerateOtp}>
                <Ionicons name="key-outline" size={18} color="#fff" />
                <Text style={styles.genBtnTxt}>Generate visit code</Text>
              </TouchableOpacity>
            )}

            {otpState === 'expired' && (
              <>
                <Text style={styles.otpExpiredTxt}>Code expired. Generate a new one.</Text>
                <TouchableOpacity style={styles.genBtn} onPress={handleGenerateOtp}>
                  <Ionicons name="refresh-outline" size={18} color="#fff" />
                  <Text style={styles.genBtnTxt}>Regenerate code</Text>
                </TouchableOpacity>
              </>
            )}

            {otpState === 'loading' && (
              <View style={styles.otpLoading}>
                <ActivityIndicator size="small" color={Colors.teal} />
                <Text style={styles.otpLoadingTxt}>Generating…</Text>
              </View>
            )}

            {otpState === 'active' && (
              <>
                <Text style={styles.otpInstructionTxt}>
                  {otpSmsConfirmed
                    ? 'Code sent to your phone. Read it aloud to your nurse.'
                    : 'Show the code below to your nurse.'}
                </Text>

                {/* Show OTP digits if available (dev mode or SMS fallback) */}
                {displayOtp ? (
                  <View style={styles.otpDisplay}>
                    {displayOtp.split('').map((digit, i) => (
                      <View key={i} style={styles.otpDigitBox}>
                        <Text style={styles.otpDigit}>{digit}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  // Production: code is in SMS only — show placeholder boxes
                  <View style={styles.otpDisplay}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={[styles.otpDigitBox, styles.otpDigitHidden]}>
                        <View style={styles.otpDash} />
                      </View>
                    ))}
                  </View>
                )}

                {/* Countdown */}
                <View style={styles.countdownRow}>
                  <Text style={styles.countdownLabel}>Expires in</Text>
                  <Text style={[styles.countdownValue, secondsLeft < 60 && { color: Colors.error }]}>
                    {mins}:{String(secs).padStart(2, '0')}
                  </Text>
                </View>

                <TouchableOpacity style={styles.regenBtn} onPress={handleGenerateOtp}>
                  <Ionicons name="refresh-outline" size={14} color={Colors.textTertiary} />
                  <Text style={styles.regenBtnTxt}>Regenerate</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, inProgress, isCompleted }: { status: string; inProgress: boolean; isCompleted: boolean }) {
  let color = Colors.textTertiary;
  let bg = Colors.surfaceAlt;
  let icon: any = 'time-outline';
  let label = 'Scheduled';

  if (isCompleted) { color = Colors.teal; bg = Colors.teal + '18'; icon = 'checkmark-circle-outline'; label = 'Completed'; }
  else if (inProgress) { color = Colors.primary; bg = Colors.primary + '18'; icon = 'pulse-outline'; label = 'Visit in progress'; }
  else if (status === 'active' || status === 'claimed') { color = '#8B5CF6'; bg = '#8B5CF6' + '18'; icon = 'person-outline'; label = 'Nurse assigned'; }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statusTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardLabel: { ...Typography.bodyBold, fontWeight: '400' as const, color: Colors.textSecondary, flex: 1 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  statusTxt: { ...Typography.bodyBold, fontWeight: '600' as const },

  trackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.teal + '18',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  trackingBtnTxt: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.teal, flex: 1 },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  summaryLabel: { ...Typography.small, color: Colors.textTertiary, fontWeight: '600' as const, marginBottom: Spacing.md },
  summaryTxt: { ...Typography.bodyBold, fontWeight: '400' as const, color: Colors.textPrimary, lineHeight: 22 },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  summaryBtnTxt: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.primary },

  otpCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.card,
    borderWidth: 1.5,
    borderColor: Colors.teal + '33',
  },
  otpHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  otpIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.teal + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  otpTitle: { ...Typography.h3, color: Colors.textPrimary },
  otpSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },

  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  genBtnTxt: { ...Typography.bodyBold, color: '#fff', fontWeight: '700' as const },

  otpExpiredTxt: { ...Typography.small, color: Colors.error, textAlign: 'center' },

  otpLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.md },
  otpLoadingTxt: { ...Typography.small, color: Colors.textSecondary },

  otpInstructionTxt: { ...Typography.small, color: Colors.textSecondary, textAlign: 'center' },

  otpDisplay: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  otpDigitBox: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: Colors.teal + '18',
    borderWidth: 2,
    borderColor: Colors.teal + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigitHidden: { backgroundColor: Colors.surfaceAlt, borderColor: Colors.divider },
  otpDigit: { fontSize: 28, fontWeight: '800' as const, color: Colors.teal },
  otpDash: { width: 20, height: 2, backgroundColor: Colors.textTertiary + '66', borderRadius: 2 },

  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  countdownLabel: { ...Typography.small, color: Colors.textTertiary },
  countdownValue: { ...Typography.bodyBold, fontWeight: '700' as const, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },

  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
  },
  regenBtnTxt: { ...Typography.small, color: Colors.textTertiary },
});