/**
 * Payment history.
 *
 * Driven by `/payments/consumer/history` — the authoritative record of what
 * was actually charged, captured or refunded. The old screen summed every
 * booking in the store regardless of whether it had been paid, so "total
 * spent" counted cancelled and unpaid bookings too.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { formatDay, inr } from '../../lib/format';
import { paymentsService, type PaymentHistoryItem } from '../../services/payments.service';

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string; icon: any }> = {
  captured: { bg: Colors.successBg, fg: Colors.success, label: 'Paid', icon: 'checkmark-circle' },
  pending: { bg: Colors.warningBg, fg: Colors.warning, label: 'Pending', icon: 'time' },
  initiated: { bg: Colors.infoBg, fg: Colors.primary, label: 'Processing', icon: 'sync' },
  failed: { bg: Colors.errorBg, fg: Colors.danger, label: 'Failed', icon: 'close-circle' },
  refunded: {
    bg: Colors.surfaceAlt,
    fg: Colors.textSecondary,
    label: 'Refunded',
    icon: 'arrow-undo',
  },
  partially_refunded: {
    bg: Colors.surfaceAlt,
    fg: Colors.textSecondary,
    label: 'Partly refunded',
    icon: 'arrow-undo',
  },
};

export default function PaymentsScreen() {
  const router = useRouter();
  const history = useStore((s) => s.paymentHistory);
  const state = useStore((s) => s.loadState.payments);
  const loadPaymentHistoryAPI = useStore((s) => s.loadPaymentHistoryAPI);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPaymentHistoryAPI().catch(() => {});
    }, [loadPaymentHistoryAPI]),
  );

  const { totalPaid, refunded, paidCount } = useMemo(() => {
    let paid = 0;
    let back = 0;
    let count = 0;
    for (const p of history) {
      const amount = Number(p.total_amount) || 0;
      if (p.payment_status === 'captured') {
        paid += amount;
        count += 1;
      } else if (p.payment_status === 'refunded') {
        back += amount;
      }
    }
    return { totalPaid: paid, refunded: back, paidCount: count };
  }, [history]);

  return (
    <SafeAreaView style={styles.safe} testID="payments-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Payments" showBack={false} />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadPaymentHistoryAPI().catch(() => {});
              setRefreshing(false);
            }}
          />
        }
      >
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Total paid</Text>
          <Text style={styles.heroValue}>{inr(totalPaid)}</Text>
          <View style={styles.heroSplit}>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Visits paid</Text>
              <Text style={styles.splitValue}>{paidCount}</Text>
            </View>
            {refunded > 0 && (
              <View style={styles.splitItem}>
                <Text style={styles.splitLabel}>Refunded</Text>
                <Text style={styles.splitValue}>{inr(refunded)}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <Text style={styles.section}>History</Text>

        <AsyncBoundary
          state={state}
          isEmpty={history.length === 0}
          emptyTitle="No payments yet"
          emptyDescription="Once you pay for a visit, the receipt and its status appear here."
          emptyIcon="card-outline"
          onRetry={() => loadPaymentHistoryAPI()}
        >
          {history.map((p) => (
            <PaymentRow
              key={`${p.booking_id}-${p.created_at}`}
              payment={p}
              onPress={() =>
                router.push({ pathname: '/visit/[id]', params: { id: p.booking_id } })
              }
            />
          ))}
        </AsyncBoundary>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Fetches the booking's tax invoice on demand and opens the PDF.
 *
 * The PDF URL isn't known until the invoice is fetched, so this is a button
 * rather than a plain link — mirrors InvoiceButton on the web admin app.
 * GET /payments/bookings/{id}/invoice returns the customer view only (no
 * internal 80/20 split) and generates the invoice on the spot if a transient
 * failure meant it was never created at payment time.
 */
function InvoiceDownload({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const invoice = await paymentsService.invoice(bookingId);
      if (invoice.pdf_url) {
        await Linking.openURL(invoice.pdf_url);
      } else {
        Alert.alert('Not ready yet', 'Your receipt is still being prepared. Please try again shortly.');
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      Alert.alert(
        'Could not load receipt',
        msg.includes('payment is completed')
          ? 'The receipt becomes available once payment is completed.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={open}
      disabled={loading}
      style={styles.invoiceBtn}
      testID={`invoice-${bookingId}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <>
          <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
          <Text style={styles.invoiceBtnTxt}>Receipt</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const PaymentRow: React.FC<{ payment: PaymentHistoryItem; onPress: () => void }> = ({
  payment,
  onPress,
}) => {
  const tone = STATUS_TONE[payment.payment_status] ?? STATUS_TONE.pending;
  const hasInvoice = payment.payment_status === 'captured' || payment.payment_status === 'refunded'
    || payment.payment_status === 'partially_refunded';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      testID={`payment-${payment.booking_id}`}
    >
      <View style={[styles.icon, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={18} color={tone.fg} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.ref}>{payment.booking_ref}</Text>
        <Text style={styles.date}>{formatDay(payment.created_at.slice(0, 10))}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amount}>{inr(payment.total_amount)}</Text>
        <Text style={[styles.status, { color: tone.fg }]}>{tone.label}</Text>
        {/* Nested TouchableOpacity: RN gives it the responder, so tapping
            "Receipt" does not also trigger the row's onPress. */}
        {hasInvoice && <InvoiceDownload bookingId={payment.booking_id} />}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.floating },
  heroLabel: { ...Typography.small, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...Typography.h1, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroSplit: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.md },
  splitItem: {},
  splitLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.75)' },
  splitValue: { ...Typography.bodyBold, color: '#fff', marginTop: 2 },
  section: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    ...Shadows.card,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ref: { ...Typography.bodyBold, color: Colors.textPrimary },
  date: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  amount: { ...Typography.bodyBold, color: Colors.textPrimary },
  status: { ...Typography.caption, fontWeight: '700' as const, marginTop: 2 },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  invoiceBtnTxt: { ...Typography.caption, color: Colors.primary, fontWeight: '700' as const },
});
