/**
 * Consumer home.
 *
 * Surfaces whatever needs attention first — a visit in progress, a booking
 * awaiting payment, a nurse being re-matched — then the next upcoming visit.
 * Bucketing uses the shared backend-status rules so this agrees with the
 * Visits tab and with the web portal.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { GradientBanner } from '../../components/GradientBanner';
import { BookingCard } from '../../components/BookingCard';
import { VisitOtpChip } from '../../components/VisitOtpChip';
import { OfflineBanner } from '../../components/OfflineBanner';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { bucketBookings } from '../../lib/booking-domain';
import { inr } from '../../lib/format';

export default function FamilyDashboard() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const bookings = useStore((s) => s.bookings);
  const patients = useStore((s) => s.patients);
  const addresses = useStore((s) => s.addresses);
  const notifications = useStore((s) => s.notifications);
  const state = useStore((s) => s.loadState.bookings);
  const bootstrapFamily = useStore((s) => s.bootstrapFamily);
  const refreshBookings = useStore((s) => s.refreshBookings);

  const [refreshing, setRefreshing] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  useFocusEffect(
    useCallback(() => {
      refreshBookings().catch(() => {});
    }, [refreshBookings]),
  );

  const buckets = useMemo(() => bucketBookings(bookings), [bookings]);
  const active = buckets.inCare[0] ?? null;
  const nextUp = buckets.upcoming[0] ?? null;
  const featured = active ?? nextUp;
  const awaitingPayment = buckets.upcoming.filter((b) => b.rawStatus === 'pending_payment');

  const completed = buckets.completed.filter((b) => b.rawStatus === 'completed');
  const totalSpent = completed.filter((b) => b.paid).reduce((s, b) => s + b.netCost, 0);

  // Booking needs both a patient and an address, so prompt for whichever is
  // missing rather than letting the user hit a dead end mid-flow.
  const setupNeeded = patients.length === 0 || addresses.length === 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await bootstrapFamily().catch(() => {});
    setRefreshing(false);
  };

  const quickActions = [
    { icon: 'medical' as const, label: 'Book care', onPress: () => router.push('/care-types') },
    { icon: 'people' as const, label: 'Patients', onPress: () => router.push('/patients') },
    { icon: 'card' as const, label: 'Payments', onPress: () => router.push('/(family)/payments') },
    { icon: 'help-buoy' as const, label: 'Help', onPress: () => router.push('/support') },
  ];

  return (
    <SafeAreaView style={styles.safe} testID="family-dashboard" edges={['top']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------------------------------------------------- header --- */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{user?.name || 'Welcome'}</Text>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/notifications')}
            testID="dashboard-notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------------ setup nudge --- */}
        {setupNeeded && (
          <TouchableOpacity
            style={styles.setupCard}
            onPress={() => router.push(patients.length === 0 ? '/patients' : '/addresses')}
            testID="dashboard-setup"
          >
            <Ionicons name="alert-circle" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>
                {patients.length === 0 ? 'Add a patient' : 'Add a service address'}
              </Text>
              <Text style={styles.setupSub}>
                {patients.length === 0
                  ? 'Tell us who you’re booking care for to get started.'
                  : 'We need an address to find nurses near you.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* -------------------------------------------- payment pending --- */}
        {awaitingPayment.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.payCard}
            onPress={() => router.push({ pathname: '/payment', params: { bookingId: b.id } })}
            testID={`dashboard-pay-${b.id}`}
          >
            <Ionicons name="card" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>Complete payment to confirm</Text>
              <Text style={styles.paySub}>
                {b.careTitle} · {inr(b.netCost)} — a nurse is only assigned once payment succeeds.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        ))}

        {/* ------------------------------------------------ live banner --- */}
        {!!active && (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
            <GradientBanner
              title="Visit in progress"
              subtitle={`${active.careTitle} with ${active.nurseName}`}
              ctaTitle="Follow live"
              icon="pulse-outline"
              onPress={() =>
                router.push({ pathname: '/tracking/[id]', params: { id: active.id } })
              }
            />
          </View>
        )}

        {/* ---------------------------------------------- quick actions --- */}
        <View style={styles.actionsRow}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={a.onPress}
              testID={`quick-${a.label}`}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --------------------------------------------------- summary --- */}
        {completed.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{completed.length}</Text>
              <Text style={styles.statLabel}>Visits completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{inr(totalSpent)}</Text>
              <Text style={styles.statLabel}>Total spent</Text>
            </View>
          </View>
        )}

        {/* --------------------------------------------------- next up --- */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{active ? 'Happening now' : 'Your next visit'}</Text>
          {buckets.upcoming.length + buckets.inCare.length > 1 && (
            <TouchableOpacity onPress={() => router.push('/(family)/visits')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ paddingHorizontal: Spacing.lg }}>
          <AsyncBoundary
            state={state}
            isEmpty={!featured}
            emptyTitle="No visits booked"
            emptyDescription="Book a care package and we’ll match you with a verified nurse nearby."
            emptyIcon="calendar-outline"
            emptyCtaTitle="Book care"
            onEmptyCtaPress={() => router.push('/care-types')}
            onRetry={() => refreshBookings()}
          >
            {!!featured && (
              <BookingCard
                booking={featured}
                onPress={() =>
                  router.push({ pathname: '/visit/[id]', params: { id: featured.id } })
                }
              >
                <VisitOtpChip bookingId={featured.id} status={featured.rawStatus} />
              </BookingCard>
            )}
          </AsyncBoundary>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  greeting: { ...Typography.small, color: Colors.textSecondary },
  name: { ...Typography.h2, color: Colors.textPrimary, marginTop: 2 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' as const },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.lg,
    padding: 14,
  },
  setupTitle: { ...Typography.bodyBold, color: Colors.warning },
  setupSub: { ...Typography.small, color: Colors.warning, marginTop: 2, lineHeight: 17 },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.lg,
    padding: 14,
  },
  payTitle: { ...Typography.bodyBold, color: Colors.primary },
  paySub: { ...Typography.small, color: Colors.primary, marginTop: 2, lineHeight: 17 },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    ...Shadows.card,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' as const },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  statValue: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary },
  seeAll: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
