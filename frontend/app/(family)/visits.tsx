import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { BookingCard } from '../../components/BookingCard';
import { VisitOtpChip } from '../../components/VisitOtpChip';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { bucketBookings } from '../../lib/booking-domain';
import type { Booking } from '../../types';

type Tab = 'upcoming' | 'inCare' | 'completed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'inCare', label: 'In care' },
  { id: 'completed', label: 'Completed' },
];

export default function VisitsScreen() {
  const router = useRouter();
  const bookings = useStore((s) => s.bookings);
  const state = useStore((s) => s.loadState.bookings);
  const refreshBookings = useStore((s) => s.refreshBookings);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  // Refetch whenever the tab regains focus — a visit can start, finish, or be
  // re-dispatched to another nurse while the user is elsewhere in the app.
  useFocusEffect(
    useCallback(() => {
      refreshBookings().catch(() => {});
    }, [refreshBookings]),
  );

  const buckets = useMemo(() => bucketBookings(bookings), [bookings]);
  const rows = buckets[tab];

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBookings().catch(() => {});
    setRefreshing(false);
  };

  const openBooking = (b: Booking) => {
    router.push({ pathname: '/visit/[id]', params: { id: b.id } });
  };

  const emptyCopy: Record<Tab, { title: string; description: string }> = {
    upcoming: {
      title: 'No upcoming visits',
      description: 'Book a visit and we’ll match you with a verified nurse nearby.',
    },
    inCare: {
      title: 'No visit in progress',
      description: 'When your nurse starts a visit, you’ll be able to follow it here.',
    },
    completed: {
      title: 'No completed visits yet',
      description: 'Finished and cancelled visits are kept here for your records.',
    },
  };

  return (
    <SafeAreaView style={styles.safe} testID="visits-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My visits" showBack={false} />

      {buckets.needsReview.length > 0 && (
        <TouchableOpacity
          style={styles.alertBar}
          onPress={() => openBooking(buckets.needsReview[0])}
          testID="visits-needs-review"
        >
          <Ionicons name="alert-circle" size={16} color={Colors.danger} />
          <Text style={styles.alertTxt}>
            {buckets.needsReview.length} visit{buckets.needsReview.length === 1 ? '' : 's'} need
            your attention
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.danger} />
        </TouchableOpacity>
      )}

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
            testID={`tab-${t.id}`}
          >
            <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtActive]}>{t.label}</Text>
            {buckets[t.id].length > 0 && (
              <View style={[styles.count, tab === t.id && styles.countActive]}>
                <Text style={[styles.countTxt, tab === t.id && { color: '#fff' }]}>
                  {buckets[t.id].length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <AsyncBoundary
        state={state}
        isEmpty={rows.length === 0}
        emptyTitle={emptyCopy[tab].title}
        emptyDescription={emptyCopy[tab].description}
        emptyIcon="calendar-outline"
        emptyCtaTitle={tab === 'upcoming' ? 'Book a visit' : undefined}
        onEmptyCtaPress={() => router.push('/care-types')}
        onRetry={() => refreshBookings()}
      >
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => openBooking(item)}>
              <VisitOtpChip bookingId={item.id} status={item.rawStatus} />
            </BookingCard>
          )}
        />
      </AsyncBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.errorBg,
    padding: 12,
    borderRadius: Radius.md,
  },
  alertTxt: { ...Typography.small, color: Colors.danger, fontWeight: '600' as const, flex: 1 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginVertical: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: Radius.md,
  },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  tabTxtActive: { color: Colors.primary },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: { backgroundColor: Colors.primary },
  countTxt: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary, fontWeight: '700' as const },
});
