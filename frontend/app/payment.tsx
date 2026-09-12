/**
 * Payment for a booking.
 *
 * Payment is what makes a booking real: the backend only sets
 * `dispatch_started_at` — and therefore only starts offering the visit to
 * nurses — once a payment is captured. So this screen must talk to the real
 * gateway rather than fabricating a result.
 *
 * Two paths, matching the web client:
 *   - real credentials  -> Razorpay Checkout in a WebView, whose signed
 *                          response is verified server-side
 *   - mock mode         -> the backend already returned a mock order, so the
 *                          checkout would 401; go straight to /verify, which
 *                          accepts mock signatures only while in mock mode
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  RazorpayCheckout,
  type RazorpaySuccess,
} from '../components/RazorpayCheckout';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { bookingsService } from '../services/bookings.service';
import {
  isMockOrder,
  type BackendPaymentOrder,
  type PaymentMethodId,
  type PaymentMethodOption,
} from '../services/payments.service';
import { mapBooking } from '../services/mappers';
import { formatDay, formatTime, humanize, inr } from '../lib/format';
import type { Booking } from '../types';

export default function Payment() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  const user = useStore((s) => s.user);
  const packages = useStore((s) => s.packages);
  const services = useStore((s) => s.services);
  const initiatePayment = useStore((s) => s.initiatePaymentAPI);
  const verifyPayment = useStore((s) => s.verifyPaymentAPI);
  const reconcilePayment = useStore((s) => s.reconcilePaymentAPI);
  const fetchPaymentMethods = useStore((s) => s.paymentMethodsAPI);
  const selectCashPayment = useStore((s) => s.selectCashPaymentAPI);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState<BackendPaymentOrder | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Payment methods are server-driven. The fallback below is only used if
  // the methods call fails, so an offline blip still lets the customer pay
  // online rather than blocking checkout entirely.
  const [methods, setMethods] = useState<PaymentMethodOption[]>([
    {
      method: 'razorpay',
      label: 'Pay online',
      description: 'UPI, card, net banking or wallet.',
      available: true,
      reason: null,
    },
  ]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('razorpay');

  // Synchronous re-entry guard. `processing` alone is not enough: React state
  // updates are async, so rapid taps (or a duplicate gateway callback) could
  // otherwise create two orders for one booking.
  const payInFlight = useRef(false);

  const resolveTitle = useCallback(
    (serviceId: string | null, packageId: string | null) =>
      packages.find((p) => p.id === packageId)?.name ??
      services.find((s) => s.id === serviceId)?.name ??
      'Home nursing visit',
    [packages, services],
  );

  // The booking summary previously showed only the package name and price —
  // no detail on what the visit actually includes. The package (and, for a
  // standalone service booking, the service) already carry that description,
  // they just weren't being looked up and shown here.
  const matchedPackage = booking?.packageId
    ? packages.find((p) => p.id === booking.packageId) ?? null
    : null;
  const matchedService = booking?.serviceId
    ? services.find((s) => s.id === booking.serviceId) ?? null
    : null;
  const careDescription = matchedPackage?.description || matchedService?.description || '';
  const careTagline = matchedPackage?.tagline || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bookingId) {
        setLoading(false);
        return;
      }
      try {
        const raw = await bookingsService.get(bookingId);
        if (cancelled) return;
        const mapped = mapBooking(raw, resolveTitle);
        setBooking(mapped);
        // Re-entering an already-paid booking must never restart payment.
        if (mapped.paid) {
          Alert.alert('Already paid', 'This booking is confirmed — no further payment is due.', [
            {
              text: 'View booking',
              onPress: () =>
                router.replace({ pathname: '/visit/[id]', params: { id: mapped.id } }),
            },
          ]);
        }
        // Which methods this booking may use. Best-effort: on failure we
        // keep the online-only fallback rather than blocking checkout.
        try {
          const res = await fetchPaymentMethods(bookingId);
          if (!cancelled && res?.methods?.length) {
            setMethods(res.methods);
            const firstAvailable = res.methods.find((m) => m.available);
            if (firstAvailable) setSelectedMethod(firstAvailable.method);
          }
        } catch {
          // keep fallback
        }
      } catch (e: any) {
        if (!cancelled) Alert.alert('Could not load booking', e?.message || 'Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, resolveTitle, router, fetchPaymentMethods]);

  const finish = useCallback(
    async (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      if (!booking) return;
      const res = await verifyPayment({ booking_id: booking.id, ...payload });
      if (res.verified) {
        router.replace({ pathname: '/payment-success', params: { id: booking.id } });
        return;
      }

      // /verify returned cleanly but says not verified. Before telling the
      // customer their payment failed, check Razorpay's own record — the
      // signature path can miss a payment that was in fact captured.
      try {
        const state = await reconcilePayment(booking.id);
        if (state.verified) {
          router.replace({ pathname: '/payment-success', params: { id: booking.id } });
          return;
        }
      } catch {
        // fall through
      }

      payInFlight.current = false;
      Alert.alert(
        'Payment not confirmed',
        'We couldn’t confirm your payment. If money was deducted it will be refunded automatically — please contact support.',
      );
    },
    [booking, verifyPayment, reconcilePayment, router],
  );

  const pay = async () => {
    if (!booking || payInFlight.current) return;
    payInFlight.current = true;
    setProcessing(true);
    try {
      const created = await initiatePayment(booking.id);
      setOrder(created);

      if (isMockOrder(created)) {
        // Backend has no live Razorpay credentials; it is in mock mode and
        // will accept a mock signature on /verify.
        await finish({
          razorpay_order_id: created.razorpay_order_id,
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).slice(2, 16)}`,
          razorpay_signature: `mock_${Math.random().toString(36).slice(2, 34)}`,
        });
        return;
      }

      setCheckoutOpen(true);
    } catch (e: any) {
      payInFlight.current = false;
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert(
        'Payment failed',
        (typeof detail === 'string' ? detail : detail?.message) || e?.message || 'Please try again.',
      );
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Cash path. Deliberately separate from `pay`: no order is created, no
   * gateway opens, and no signature is verified — the booking is simply
   * confirmed with the money due at the visit. Sharing a handler with the
   * online flow would mean threading `if cash` through every step of it.
   */
  const payWithCash = async () => {
    if (!booking || payInFlight.current) return;
    payInFlight.current = true;
    setProcessing(true);
    try {
      await selectCashPayment(booking.id);
      router.replace({
        pathname: '/payment-success',
        params: { id: booking.id, method: 'cash' },
      });
    } catch (e: any) {
      payInFlight.current = false;
      Alert.alert(
        'Could not confirm your booking',
        e?.message || 'Please try again, or choose to pay online instead.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const onCheckoutSuccess = async (result: RazorpaySuccess) => {
    setCheckoutOpen(false);
    setProcessing(true);
    try {
      await finish(result);
    } catch (e: any) {
      // Razorpay told us the payment succeeded, but our own /verify call
      // did not complete. The customer has very likely been charged, so
      // showing them a bare failure here is wrong — that is exactly the
      // "amount deducted but Verification failed (500)" report.
      //
      // Ask the backend to settle the booking against Razorpay's own record
      // of the order before we say anything. This does NOT force success on
      // the client: the backend confirms with Razorpay and only then marks
      // the booking paid.
      try {
        const state = await reconcilePayment(booking!.id);
        if (state.verified) {
          router.replace({ pathname: '/payment-success', params: { id: booking!.id } });
          return;
        }
      } catch {
        // Reconciliation itself failed — fall through to the message below.
      }

      payInFlight.current = false;
      Alert.alert(
        'We could not confirm your payment',
        'If money was deducted it is safe — your booking will update automatically, ' +
          'and any uncollected amount is refunded by your bank. Pull to refresh on ' +
          'My visits in a few minutes, or contact support with your reference number.',
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Payment" fallbackHref="/(family)/visits" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Payment" fallbackHref="/(family)/visits" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyTxt}>We couldn’t find that booking.</Text>
          <GradientButton
            title="Back to visits"
            fullWidth={false}
            onPress={() => router.replace('/(family)/visits')}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="payment-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Payment" fallbackHref="/(family)/visits" />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>Booking summary</Text>
          <Row label="Care package" value={booking.careTitle} />
          <Row label="Reference" value={booking.bookingRef || '—'} />
          <Row
            label="Date & time"
            value={`${formatDay(booking.date, { day: '2-digit', month: 'short' })} · ${formatTime(
              booking.slot,
            )}`}
          />
          <Row label="Address" value={booking.address} />
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Amount payable</Text>
            <Text style={styles.totalR}>{inr(booking.netCost)}</Text>
          </View>
        </View>

        {/* --------------------------------------------- what's included --- */}
        {(careDescription || matchedPackage) && (
          <View style={styles.includedCard}>
            <Text style={styles.includedTitle}>What's included</Text>
            {!!careTagline && <Text style={styles.includedTagline}>{careTagline}</Text>}
            {!!careDescription && <Text style={styles.includedDesc}>{careDescription}</Text>}

            {!!matchedPackage && (
              <View style={styles.includedMetaRow}>
                {!!matchedPackage.visit_frequency && (
                  <IncludedMeta
                    icon="repeat-outline"
                    text={humanize(matchedPackage.visit_frequency)}
                  />
                )}
                {!!matchedPackage.visits_per_cycle && (
                  <IncludedMeta
                    icon="calendar-outline"
                    text={`${matchedPackage.visits_per_cycle} visit${
                      matchedPackage.visits_per_cycle === 1 ? '' : 's'
                    }`}
                  />
                )}
                {!!matchedPackage.shift_hours && (
                  <IncludedMeta icon="time-outline" text={`${matchedPackage.shift_hours}h shift`} />
                )}
                {!!matchedPackage.requires_prescription && (
                  <IncludedMeta icon="document-text-outline" text="Prescription required" />
                )}
                {!!matchedPackage.subsidy_eligible && (
                  <IncludedMeta icon="ribbon-outline" text="Subsidy eligible" />
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={18} color={Colors.primary} />
          <Text style={styles.noticeTxt}>
            You’ll choose how to pay — UPI, card, net banking or wallet — on the secure Razorpay
            screen. We never see or store your payment details.
          </Text>
        </View>

        {/* Payment method. Options come from the backend
            (/payments/methods/{id}) rather than being hardcoded here, so
            availability rules live in one place. */}
        <View style={styles.methodBox}>
          <Text style={styles.methodHeading}>How would you like to pay?</Text>
          {methods.map((m) => {
            const selected = m.method === selectedMethod;
            return (
              <TouchableOpacity
                key={m.method}
                disabled={!m.available}
                onPress={() => setSelectedMethod(m.method)}
                style={[
                  styles.methodRow,
                  selected && styles.methodRowSelected,
                  !m.available && styles.methodRowDisabled,
                ]}
                testID={`method-${m.method}`}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? Colors.teal : Colors.textTertiary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodSub}>{m.reason ?? m.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.secureBox}>
          <FontAwesome5 name="lock" size={12} color={Colors.success} />
          <Text style={styles.secureTxt}>
            {selectedMethod === 'cash'
              ? 'Pay your care professional directly at the visit · Full refund if you cancel more than 6 hours before'
              : 'Secured by Razorpay · Full refund if you cancel more than 6 hours before the visit'}
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <GradientButton
          title={
            selectedMethod === 'cash'
              ? `Confirm booking · Pay ${inr(booking.netCost)} at visit`
              : `Pay ${inr(booking.netCost)}`
          }
          loading={processing}
          onPress={selectedMethod === 'cash' ? payWithCash : pay}
          testID="pay-btn"
        />
      </SafeAreaView>

      <RazorpayCheckout
        visible={checkoutOpen}
        order={order}
        description={`${booking.careTitle} · ${booking.bookingRef ?? ''}`.trim()}
        prefill={{
          name: user?.name || undefined,
          email: user?.email || undefined,
          contact: user?.phone || undefined,
        }}
        onSuccess={onCheckoutSuccess}
        onCancel={() => {
          setCheckoutOpen(false);
          payInFlight.current = false;
        }}
        onError={(message) => {
          setCheckoutOpen(false);
          payInFlight.current = false;
          Alert.alert('Payment failed', message);
        }}
      />
    </SafeAreaView>
  );
}

const IncludedMeta: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({
  icon,
  text,
}) => (
  <View style={styles.includedMeta}>
    <Ionicons name={icon} size={13} color={Colors.textSecondary} />
    <Text style={styles.includedMetaTxt}>{text}</Text>
  </View>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.sumRow}>
    <Text style={styles.sumL}>{label}</Text>
    <Text style={styles.sumR} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    ...Shadows.card,
  },
  sumTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  sumL: { ...Typography.body, color: Colors.textSecondary },
  sumR: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalL: { ...Typography.h4, color: Colors.textPrimary },
  totalR: { ...Typography.h2, color: Colors.primary, fontWeight: '800' as const },
  includedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  includedTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 6 },
  includedTagline: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  includedDesc: { ...Typography.body, color: Colors.textPrimary, lineHeight: 21 },
  includedMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  includedMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  includedMetaTxt: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: 14,
    marginTop: Spacing.md,
  },
  noticeTxt: { ...Typography.small, color: Colors.primary, flex: 1, lineHeight: 18 },
  methodBox: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 14,
  },
  methodHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 8,
  },
  methodRowSelected: {
    borderColor: Colors.teal,
    backgroundColor: 'rgba(0,150,136,0.06)',
  },
  methodRowDisabled: {
    opacity: 0.45,
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  methodSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  secureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  secureTxt: { ...Typography.small, color: Colors.success, flex: 1, lineHeight: 17 },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
