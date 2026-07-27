/**
 * Consumer booking detail.
 *
 * Shows the live visit-start code, the cancellation window (matching the
 * server's 6-hour rule so we never offer a button that will be refused), the
 * payment state, and — once the nurse checks out — the visit report.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { BookingStatusBadge } from '../../components/BookingStatusBadge';
import { VisitOtpChip } from '../../components/VisitOtpChip';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { bookingsService } from '../../services/bookings.service';
import { visitsService, type VisitRecordOut } from '../../services/visits.service';
import { mapBooking } from '../../services/mappers';
import {
  CANCELLATION_CLOSED_MESSAGE,
  canCancel,
  hasAssignedNurse,
  isTerminal,
} from '../../lib/booking-domain';
import { formatDay, formatTime, inr } from '../../lib/format';
import { callManager } from '../../lib/call-manager';
import type { Booking } from '../../types';

export default function BookingDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const storeBooking = useStore((s) => s.bookings.find((b) => b.id === id));
  const packages = useStore((s) => s.packages);
  const services = useStore((s) => s.services);
  const refreshBookings = useStore((s) => s.refreshBookings);
  const cancelBookingAPI = useStore((s) => s.cancelBookingAPI);
  const refundBookingAPI = useStore((s) => s.refundBookingAPI);

  const [booking, setBooking] = useState<Booking | null>(storeBooking ?? null);
  const [visit, setVisit] = useState<VisitRecordOut | null>(null);
  const [loading, setLoading] = useState(!storeBooking);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const resolveTitle = useCallback(
    (serviceId: string | null, packageId: string | null) =>
      packages.find((p) => p.id === packageId)?.name ??
      services.find((s) => s.id === serviceId)?.name ??
      'Home nursing visit',
    [packages, services],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const raw = await bookingsService.get(id);
      setBooking(mapBooking(raw, resolveTitle));
    } catch (e: any) {
      setError(e?.message || 'Could not load this booking');
    } finally {
      setLoading(false);
    }
    // The visit record only exists once the nurse has checked in, so a failure
    // here is normal rather than an error worth surfacing.
    try {
      setVisit(await visitsService.get(id));
    } catch {
      setVisit(null);
    }
  }, [id, resolveTitle]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    await refreshBookings().catch(() => {});
    setRefreshing(false);
  };

  const cancellable = useMemo(() => (booking ? canCancel(booking) : false), [booking]);

  const describeError = (e: any, fallback: string) => {
    const detail = e?.detail?.detail ?? e?.detail;
    if (detail?.code === 'CANCELLATION_WINDOW_CLOSED') return CANCELLATION_CLOSED_MESSAGE;
    if (typeof detail?.message === 'string') return detail.message;
    return e?.message || fallback;
  };

  const confirmCancel = () => {
    if (!booking) return;
    const refundable = booking.paid;
    Alert.alert(
      refundable ? 'Cancel and request refund?' : 'Cancel this booking?',
      refundable
        ? `Your payment of ${inr(booking.netCost)} will be refunded to the original payment method within 5–7 working days.`
        : 'This booking will be cancelled and no nurse will be dispatched.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: refundable ? 'Cancel & refund' : 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (refundable) {
                await refundBookingAPI(
                  booking.id,
                  booking.netCost,
                  `Consumer cancelled — ${booking.careTitle}`,
                );
              } else {
                await cancelBookingAPI(booking.id, 'Cancelled by consumer');
              }
              await load();
            } catch (e: any) {
              Alert.alert('Could not cancel', describeError(e, 'Please try again.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Booking" fallbackHref="/(family)/visits" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Booking" fallbackHref="/(family)/visits" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error || 'This booking could not be found.'}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const nurseAssigned = hasAssignedNurse(booking);
  const trackable = ['worker_en_route', 'worker_arrived', 'in_progress'].includes(
    booking.rawStatus,
  );
  const showCancel = !isTerminal(booking.rawStatus) && booking.rawStatus !== 'draft';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="booking-detail">
      <OfflineBanner />
      <Header title={booking.bookingRef || 'Booking'} fallbackHref="/(family)/visits" />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------------------------------------------------- summary --- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.title}>{booking.careTitle}</Text>
              <Text style={styles.sub}>
                {formatDay(booking.date)} · {formatTime(booking.slot)}
              </Text>
            </View>
            <BookingStatusBadge status={booking.rawStatus} />
          </View>

          {booking.rawStatus === 'rematch_pending' && (
            <View style={styles.infoRow}>
              <Ionicons name="sync" size={16} color={Colors.warning} />
              <Text style={[styles.infoTxt, { color: Colors.warning }]}>
                Your nurse had to cancel. We’re finding you a replacement and will notify you as
                soon as someone accepts.
              </Text>
            </View>
          )}

          <VisitOtpChip bookingId={booking.id} status={booking.rawStatus} />

          <View style={styles.divider} />

          <DetailRow icon="person-outline" label="Nurse">
            {nurseAssigned ? booking.nurseName : 'Not assigned yet'}
          </DetailRow>
          <DetailRow icon="location-outline" label="Address">
            {booking.address}
          </DetailRow>
          <DetailRow icon="hourglass-outline" label="Duration">
            {`${booking.duration}h`}
          </DetailRow>
          {!!booking.notes && (
            <DetailRow icon="document-text-outline" label="Instructions">
              {booking.notes}
            </DetailRow>
          )}
          {!!booking.cancellationReason && (
            <DetailRow icon="close-circle-outline" label="Cancellation reason">
              {booking.cancellationReason}
            </DetailRow>
          )}
        </View>

        {/* ---------------------------------------------------- actions --- */}
        <View style={styles.actionRow}>
          {trackable && (
            <TouchableOpacity
              style={styles.action}
              onPress={() =>
                router.push({ pathname: '/tracking/[id]', params: { id: booking.id } })
              }
              testID="action-track"
            >
              <Ionicons name="navigate" size={20} color={Colors.primary} />
              <Text style={styles.actionTxt}>Track</Text>
            </TouchableOpacity>
          )}
          {nurseAssigned && (
            <TouchableOpacity
              style={styles.action}
              onPress={() =>
                router.push({ pathname: '/chat/[bookingId]', params: { bookingId: booking.id } })
              }
              testID="action-chat"
            >
              <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
              <Text style={styles.actionTxt}>Message</Text>
            </TouchableOpacity>
          )}
          {nurseAssigned && (
            <TouchableOpacity
              style={styles.action}
              onPress={() => callManager.startCall(booking.id, booking.nurseName)}
              testID="action-call"
            >
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.actionTxt}>Call</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.action}
            onPress={() => router.push('/support/raise')}
            testID="action-help"
          >
            <Ionicons name="help-buoy" size={20} color={Colors.primary} />
            <Text style={styles.actionTxt}>Get help</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------- payment --- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amount}>{inr(booking.netCost)}</Text>
          </View>
          <View style={styles.payStatusRow}>
            <Ionicons
              name={booking.paid ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={booking.paid ? Colors.success : Colors.warning}
            />
            <Text
              style={[
                styles.payStatusTxt,
                { color: booking.paid ? Colors.success : Colors.warning },
              ]}
            >
              {paymentLabel(booking)}
            </Text>
          </View>

          {booking.rawStatus === 'pending_payment' && (
            <GradientButton
              title={`Pay ${inr(booking.netCost)}`}
              onPress={() =>
                router.push({ pathname: '/payment', params: { bookingId: booking.id } })
              }
              style={{ marginTop: Spacing.md }}
              testID="pay-now"
            />
          )}
        </View>

        {/* ------------------------------------------------ visit report -- */}
        {!!visit?.check_out_at && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Visit report</Text>
            {!!visit.family_summary && (
              <>
                <Text style={styles.reportLabel}>Summary for you</Text>
                <Text style={styles.reportBody}>{visit.family_summary}</Text>
              </>
            )}
            {!!visit.care_notes && (
              <>
                <Text style={[styles.reportLabel, { marginTop: Spacing.md }]}>Care notes</Text>
                <Text style={styles.reportBody}>{visit.care_notes}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.rateRow}
              onPress={() =>
                router.push({ pathname: '/visit-success/[id]', params: { id: booking.id } })
              }
              testID="rate-visit"
            >
              <MaterialCommunityIcons
                name={visit.rating_by_consumer ? 'star' : 'star-outline'}
                size={18}
                color={Colors.warning}
              />
              <Text style={styles.rateTxt}>
                {visit.rating_by_consumer
                  ? `You rated this visit ${visit.rating_by_consumer}/5`
                  : 'Rate this visit'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ----------------------------------------------- cancellation --- */}
        {showCancel && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cancel this booking</Text>
            {cancellable ? (
              <>
                <Text style={styles.cancelHint}>
                  {booking.paid
                    ? 'You’ll be refunded in full to your original payment method.'
                    : 'No charge will be made.'}
                </Text>
                <GradientButton
                  title={booking.paid ? 'Cancel & request refund' : 'Cancel booking'}
                  variant="outline"
                  loading={busy}
                  onPress={confirmCancel}
                  style={{ marginTop: Spacing.md }}
                  testID="cancel-booking"
                />
              </>
            ) : (
              <View style={styles.lockedRow}>
                <Ionicons name="lock-closed" size={16} color={Colors.textSecondary} />
                <Text style={styles.lockedTxt}>{CANCELLATION_CLOSED_MESSAGE}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function paymentLabel(b: Booking): string {
  switch (b.paymentStatus) {
    case 'captured':
      return 'Paid';
    case 'refunded':
      return 'Refunded — allow 5–7 working days';
    case 'partially_refunded':
      return 'Partially refunded';
    case 'failed':
      return 'Payment failed — please try again';
    case 'initiated':
      return 'Payment in progress';
    default:
      return 'Awaiting payment';
  }
}

const DetailRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}> = ({ icon, label, children }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={16} color={Colors.textTertiary} style={{ marginTop: 2 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{children}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...Typography.h3, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.warningBg,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  infoTxt: { ...Typography.small, flex: 1, lineHeight: 18 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  detailRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  detailLabel: { ...Typography.caption, color: Colors.textTertiary },
  detailValue: { ...Typography.body, color: Colors.textPrimary, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  action: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
    ...Shadows.card,
  },
  actionTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  amountLabel: { ...Typography.body, color: Colors.textSecondary },
  amount: { ...Typography.h2, color: Colors.textPrimary, fontWeight: '800' as const },
  payStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  payStatusTxt: { ...Typography.small, fontWeight: '600' as const },
  reportLabel: { ...Typography.caption, color: Colors.textTertiary },
  reportBody: { ...Typography.body, color: Colors.textPrimary, marginTop: 4, lineHeight: 21 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  rateTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  cancelHint: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
  lockedRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  lockedTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
});
