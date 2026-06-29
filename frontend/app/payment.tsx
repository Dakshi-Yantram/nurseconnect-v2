import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
// SafeAreaView reused for sticky bar bottom inset
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { Booking } from '../types';

const METHODS = [
  { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm', icon: 'phone-portrait-outline' },
  { id: 'card', label: 'Credit / Debit Card', sub: 'HDFC, ICICI, SBI…', icon: 'card-outline' },
  { id: 'netbanking', label: 'Net Banking', sub: '50+ banks supported', icon: 'business-outline' },
] as const;

export default function Payment() {
  const router = useRouter();
  const draft = useStore((s) => s.draftBooking);
  const bookings = useStore((s) => s.bookings);
  const addBooking = useStore((s) => s.addBooking);
  const initiatePayment = useStore((s) => s.initiatePaymentAPI);
  const verifyPayment = useStore((s) => s.verifyPaymentAPI);
  const [method, setMethod] = useState<string>('upi');
  const [processing, setProcessing] = useState(false);
  // Synchronous re-entry guard: prevents duplicate booking creation when
  //  - user taps Pay multiple times before React state updates
  //  - Razorpay success callback fires twice
  //  - useEffect mounts trigger duplicate calls
  // setProcessing alone is not enough because React state updates are async.
  const payInFlight = useRef(false);

  // Phase 4: real backend payment when a backend UUID is present.
  const isBackendBookingId = (id?: string) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Guard: if user re-enters this screen for a booking that is already paid/confirmed,
  // never restart payment. Redirect to Booking Details with the spec's exact message.
  useEffect(() => {
    const existing = draft?.id ? bookings.find((b) => b.id === draft.id) : null;
    const alreadyPaid =
      !!draft?.paid ||
      !!existing?.paid ||
      ['scheduled', 'enroute', 'active', 'completed'].includes(String(existing?.status));
    if (alreadyPaid) {
      Alert.alert(
        'Already confirmed',
        'This booking is already confirmed. Payment has been completed.',
        [
          {
            text: 'View Booking',
            onPress: () =>
              router.replace({
                pathname: '/visit/[id]',
                params: { id: (existing?.id || draft?.id) as string },
              }),
          },
        ],
        { cancelable: false },
      );
    }
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    // Hard idempotency guard — synchronous, survives multiple rapid taps and
    // duplicate success callbacks before React re-renders the disabled button.
    if (payInFlight.current) return;
    payInFlight.current = true;
    setProcessing(true);
    try {
      if (isBackendBookingId(draft?.id)) {
        // Production payment lifecycle (mocked Razorpay in dev: signature passes).
        const order = await initiatePayment(draft!.id as string);
        // razorpay_payment_id acts as the idempotency key on the backend; the
        // backend rejects duplicate verify calls for the same payment id.
        const razorpay_payment_id = 'pay_mock_' + draft!.id;
        await verifyPayment({
          booking_id: order.booking_id,
          razorpay_order_id: order.razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature: 'mock_signature',
        });
        router.replace({ pathname: '/payment-success', params: { id: draft!.id as string } });
        return;
      }
      // Local-only demo fallback (preserves existing flow when there's no backend booking yet).
      const newBooking: Booking = {
        id: 'b' + Date.now(),
        nurseId: draft?.nurseId || '',
        nurseName: draft?.nurseName || '',
        nurseAvatar: draft?.nurseAvatar || '',
        careTypeId: draft?.careTypeId || '',
        careTitle: draft?.careTitle || '',
        date: draft?.date || new Date().toISOString(),
        slot: draft?.slot || '10:00 AM',
        duration: draft?.duration || 1,
        address: draft?.address || '',
        notes: draft?.notes,
        cost: draft?.cost || 0,
        subsidy: draft?.subsidy || 0,
        netCost: draft?.netCost || 0,
        status: 'scheduled',
        paid: true,
        paymentMethod: METHODS.find((m) => m.id === method)?.label,
        createdAt: new Date().toISOString(),
      };
      addBooking(newBooking);
      router.replace({ pathname: '/payment-success', params: { id: newBooking.id } });
    } catch (e: any) {
      // Reset guard on failure so user can retry.
      payInFlight.current = false;
      Alert.alert('Payment failed', e?.message || 'Please try again');
    } finally {
      setProcessing(false);
      // Note: we intentionally do NOT reset payInFlight on success — the screen is
      // replaced and unmounted, so the guard prevents any late callback from firing
      // a duplicate booking creation.
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="payment-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Payment" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sumTitle}>Booking summary</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumL}>Service</Text>
            <Text style={styles.sumR}>{draft?.careTitle}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumL}>Nurse</Text>
            <Text style={styles.sumR}>{draft?.nurseName}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumL}>Date · Time</Text>
            <Text style={styles.sumR}>
              {new Date(draft?.date || Date.now()).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
              })}{' '}
              · {draft?.slot}
            </Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumL}>Duration</Text>
            <Text style={styles.sumR}>{draft?.duration}h</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Amount payable</Text>
            <Text style={styles.totalR}>₹{draft?.netCost}</Text>
          </View>
        </View>

        {/* Methods */}
        <Text style={styles.sectionTitle}>Choose payment method</Text>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.methodRow, method === m.id && styles.methodActive]}
            onPress={() => setMethod(m.id)}
            testID={`method-${m.id}`}
          >
            <View
              style={[
                styles.methodIcon,
                { backgroundColor: method === m.id ? Colors.primary : Colors.infoBg },
              ]}
            >
              <Ionicons
                name={m.icon as any}
                size={20}
                color={method === m.id ? '#fff' : Colors.primary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.methodLabel}>{m.label}</Text>
              <Text style={styles.methodSub}>{m.sub}</Text>
            </View>
            <View style={[styles.radio, method === m.id && styles.radioActive]}>
              {method === m.id && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.secureBox}>
          <FontAwesome5 name="lock" size={12} color={Colors.success} />
          <Text style={styles.secureTxt}>
            Payments are secured with 256-bit encryption · 100% refund on cancellation
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <GradientButton
          title={`Pay ₹${draft?.netCost || 0}`}
          loading={processing}
          onPress={pay}
          testID="pay-btn"
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, ...Shadows.card },
  sumTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  sumL: { ...Typography.body, color: Colors.textSecondary },
  sumR: { ...Typography.bodyBold, color: Colors.textPrimary },
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
  sectionTitle: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  methodActive: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
  methodSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  secureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: 16,
  },
  secureTxt: { ...Typography.small, color: Colors.success, flex: 1 },
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
