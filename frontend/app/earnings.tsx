import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { formatDay, humanize, inr } from '../lib/format';
import { paymentsService, type PayoutStatement } from '../services/payments.service';

/**
 * "Payout Advice & Tax Invoice" access, per released payment.
 *
 * Loaded independently of the earnings summary above: a failure here must
 * not blank out the payout totals, which are the primary content of this
 * screen. `payout_status` reflects what Razorpay has actually confirmed —
 * an in-flight transfer never renders a UTR or reads as settled.
 */
function usePayoutStatements() {
  const [statements, setStatements] = useState<PayoutStatement[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    paymentsService
      .payoutStatements()
      .then(setStatements)
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { statements, loading, reload };
}

function openPdf(url: string | null) {
  if (!url) {
    Alert.alert('Not ready yet', 'The statement PDF is still being prepared. Please check back shortly.');
    return;
  }
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open', 'The statement link appears to be invalid.'),
  );
}

export default function Earnings() {
  const assignments = useStore((s) => s.assignments);
  const earnings = useStore((s) => s.earnings);
  const loadEarningsAPI = useStore((s) => s.loadEarningsAPI);
  const { statements, loading: statementsLoading } = usePayoutStatements();

  useEffect(() => {
    loadEarningsAPI().catch(() => {});
  }, [loadEarningsAPI]);

  // Only the payout ledger is authoritative about money. Falling back to
  // summing booking values (as this screen used to) overstated earnings: a
  // booking's total is what the *consumer* pays, before commission and TDS,
  // and it counted visits that were never completed or paid out.
  const completedTotal = Number(earnings?.total_paid ?? 0);
  const upcomingTotal = Number(earnings?.total_pending ?? 0);
  const totalThisMonth = completedTotal + upcomingTotal;
  const payouts = earnings?.payouts || [];
  const completedVisits = assignments.filter((a) => a.rawStatus === 'completed').length;

  return (
    <SafeAreaView style={styles.safe} testID="earnings-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Earnings" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <LinearGradient
          colors={Gradients.successCard as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.label}>Total earnings</Text>
          <Text style={styles.value}>{inr(totalThisMonth)}</Text>
          <View style={styles.heroSplit}>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Paid out</Text>
              <Text style={styles.splitValue}>{inr(completedTotal)}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Pending</Text>
              <Text style={styles.splitValue}>{inr(upcomingTotal)}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Visits done</Text>
              <Text style={styles.splitValue}>{completedVisits}</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.section}>Recent payouts</Text>
        {payouts.length > 0 ? (
          payouts.slice(0, 8).map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name="cash" size={18} color={Colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>Payout · {humanize(p.status)}</Text>
                <Text style={styles.rowSub}>
                  Gross {inr(Number(p.gross_amount))} · TDS {inr(Number(p.tds_deducted))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amt}>+{inr(Number(p.net_amount))}</Text>
                <Text style={styles.date}>
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="cash" size={18} color={Colors.success} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowTitle}>No payouts yet</Text>
              <Text style={styles.rowSub}>Payouts appear here after each completed visit</Text>
            </View>
          </View>
        )}

        <Text style={styles.section}>Payout statements</Text>
        <Text style={styles.sectionNote}>
          The full tax invoice for each payout — gross earned, the platform fee billed back to
          you, GST, and the final amount transferred to your bank account.
        </Text>
        {statements.length > 0 ? (
          statements.map((st) => (
            <TouchableOpacity
              key={st.statement_number}
              style={styles.row}
              onPress={() => openPdf(st.pdf_url)}
              testID={`payout-statement-${st.statement_number}`}
            >
              <View style={styles.icon}>
                <Ionicons name="document-text" size={18} color={Colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>
                  {st.booking_ref} · {inr(st.final_disbursal)}
                </Text>
                <Text style={styles.rowSub}>
                  Earned {inr(st.gross_earned)} · fee {inr(st.platform_fee + st.platform_fee_gst)}
                  {st.total_deductions > 0 ? ` · deductions ${inr(st.total_deductions)}` : ''}
                </Text>
                {st.utr ? (
                  <Text style={styles.rowMono}>UTR {st.utr}</Text>
                ) : st.payout_status !== 'paid' ? (
                  <Text style={styles.rowPending}>Awaiting bank confirmation</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View
                  style={[
                    styles.statusPill,
                    st.payout_status === 'paid'
                      ? { backgroundColor: Colors.successBg }
                      : st.payout_status === 'failed'
                        ? { backgroundColor: Colors.errorBg }
                        : { backgroundColor: Colors.warningBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillTxt,
                      {
                        color:
                          st.payout_status === 'paid'
                            ? Colors.success
                            : st.payout_status === 'failed'
                              ? Colors.danger
                              : Colors.warning,
                      },
                    ]}
                  >
                    {st.payout_status === 'processing' ? 'in transit' : st.payout_status}
                  </Text>
                </View>
                {st.pdf_url && <Ionicons name="open-outline" size={14} color={Colors.textTertiary} style={{ marginTop: 6 }} />}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="document-text" size={18} color={Colors.success} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowTitle}>
                {statementsLoading ? 'Loading…' : 'No statements yet'}
              </Text>
              <Text style={styles.rowSub}>Your payout advice appears here once a payment is released</Text>
            </View>
          </View>
        )}

        <Text style={styles.section}>Completed visits</Text>
        <Text style={styles.sectionNote}>
          Your payout per visit is the visit value less platform commission and TDS — see the
          payout rows above for the exact amounts.
        </Text>
        {assignments
          .filter((a) => a.rawStatus === 'completed')
          .map((a) => (
            <View key={a.id} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: Colors.infoBg }]}>
                <MaterialCommunityIcons name="medical-bag" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>{a.careTitle}</Text>
                <Text style={styles.rowSub}>
                  {formatDay(a.date, { day: '2-digit', month: 'short' })} · {a.duration}h
                </Text>
              </View>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { borderRadius: Radius.xl, padding: 20, ...Shadows.floating },
  label: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  value: { ...Typography.h1, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroSplit: { flexDirection: 'row', marginTop: 16, gap: 8 },
  splitItem: { flex: 1, padding: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.md },
  splitLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)', fontSize: 9 },
  splitValue: { ...Typography.h4, color: '#fff', fontWeight: '700' as const, marginTop: 4 },
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 8 },
  sectionNote: { ...Typography.small, color: Colors.textSecondary, marginBottom: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.lg, marginBottom: 8, ...Shadows.card },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  amt: { ...Typography.bodyBold, color: Colors.success, fontWeight: '800' as const },
  date: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  rowMono: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2, fontFamily: 'monospace' },
  rowPending: { ...Typography.caption, color: Colors.warning, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm },
  statusPillTxt: { ...Typography.caption, fontWeight: '700' as const, textTransform: 'uppercase' as const, fontSize: 9 },
});
