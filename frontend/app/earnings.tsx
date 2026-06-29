import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

export default function Earnings() {
  const assignments = useStore((s) => s.assignments);
  const earnings = useStore((s) => s.earnings);
  const loadEarningsAPI = useStore((s) => s.loadEarningsAPI);

  useEffect(() => {
    loadEarningsAPI().catch(() => {});
  }, [loadEarningsAPI]);

  const completed = assignments.filter((a) => a.status === 'completed');
  const backendTotal = earnings ? Number(earnings.total_paid) + Number(earnings.total_pending) : 0;
  const totalThisMonth = backendTotal > 0 ? backendTotal : assignments.reduce((s, a) => s + a.netCost, 0);
  const completedTotal = earnings ? Number(earnings.total_paid) : completed.reduce((s, a) => s + a.netCost, 0);
  const upcomingTotal = earnings
    ? Number(earnings.total_pending)
    : assignments.reduce((s, a) => s + (a.status !== 'completed' ? a.netCost : 0), 0);
  const payouts = earnings?.payouts || [];

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
          <Text style={styles.label}>This month</Text>
          <Text style={styles.value}>₹{totalThisMonth.toLocaleString('en-IN')}</Text>
          <View style={styles.heroSplit}>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Earned</Text>
              <Text style={styles.splitValue}>₹{completedTotal}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Upcoming</Text>
              <Text style={styles.splitValue}>₹{upcomingTotal}</Text>
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>Visits</Text>
              <Text style={styles.splitValue}>{assignments.length}</Text>
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
                <Text style={styles.rowTitle}>Payout {p.status}</Text>
                <Text style={styles.rowSub}>
                  Booking ref · TDS ₹{Number(p.tds_deducted).toFixed(0)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amt}>+₹{Number(p.net_amount).toFixed(0)}</Text>
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

        <Text style={styles.section}>Recent visits</Text>
        {assignments.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: Colors.infoBg }]}>
              <MaterialCommunityIcons name="medical-bag" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowTitle}>{a.careTitle}</Text>
              <Text style={styles.rowSub}>
                {new Date(a.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}{' '}
                · {a.duration}h
              </Text>
            </View>
            <Text style={styles.amt}>₹{a.netCost}</Text>
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
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.lg, marginBottom: 8, ...Shadows.card },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  amt: { ...Typography.bodyBold, color: Colors.success, fontWeight: '800' as const },
  date: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
});
