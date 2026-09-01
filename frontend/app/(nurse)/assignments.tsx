/**
 * Care professional's visits.
 *
 * Three views: open requests the nurse may claim, their upcoming/active
 * visits, and history. Cancelling from here does NOT kill the booking — the
 * server moves it to `rematch_pending` and re-offers it to other qualified
 * nurses — so the copy says exactly that.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { BookingStatusBadge } from '../../components/BookingStatusBadge';
import { NurseSafetyCheckModal } from '../../components/NurseSafetyCheckModal';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { canNurseCancel, CANCELLATION_CLOSED_MESSAGE } from '../../lib/booking-domain';
import { formatDay, formatTime, inr } from '../../lib/format';
import type { Booking } from '../../types';

type Tab = 'requests' | 'upcoming' | 'past';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'History' },
];

/** Deep link to the maps app — no SDK or API key involved. */
function openInMaps(lat?: number, lng?: number) {
  if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
    Alert.alert('Location unavailable', 'No coordinates are on file for this booking.');
    return;
  }
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open Maps'));
}

export default function Assignments() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(
    tabParam === 'past' ? 'past' : tabParam === 'requests' ? 'requests' : 'upcoming',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Booking pending an alertness check before Maps opens for it (null = modal hidden).
  const [pendingNavBooking, setPendingNavBooking] = useState<Booking | null>(null);

  const assignments = useStore((s) => s.assignments);
  const newRequests = useStore((s) => s.newRequests);
  const assignmentsState = useStore((s) => s.loadState.assignments);
  const requestsState = useStore((s) => s.loadState.newRequests);
  const eligibility = useStore((s) => s.eligibility);
  const refreshAssignmentsAPI = useStore((s) => s.refreshAssignmentsAPI);
  const refreshNewRequestsAPI = useStore((s) => s.refreshNewRequestsAPI);
  const acceptAPI = useStore((s) => s.acceptAssignmentAPI);
  const cancelAPI = useStore((s) => s.cancelAssignmentAPI);

  useFocusEffect(
    useCallback(() => {
      refreshAssignmentsAPI().catch(() => {});
      refreshNewRequestsAPI().catch(() => {});
    }, [refreshAssignmentsAPI, refreshNewRequestsAPI]),
  );

  const { upcoming, past } = useMemo(() => {
    const done = ['completed', 'cancelled', 'missed'];
    return {
      upcoming: assignments.filter((a) => !done.includes(a.rawStatus)),
      past: assignments.filter((a) => done.includes(a.rawStatus)),
    };
  }, [assignments]);

  const rows = tab === 'requests' ? newRequests : tab === 'upcoming' ? upcoming : past;
  const state = tab === 'requests' ? requestsState : assignmentsState;
  // What actually decides whether requests reach this nurse: qualified for
  // the offering AND not explicitly opted out of it.
  const eligibleCount = eligibility.filter(
    (e) => e.can_opt_in && e.preference_status === 'OPTED_IN',
  ).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refreshAssignmentsAPI(), refreshNewRequestsAPI()]);
    setRefreshing(false);
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const accept = (b: Booking) =>
    withBusy(b.id, async () => {
      try {
        await acceptAPI(b.id);
        setTab('upcoming');
      } catch (e: any) {
        const code = e?.detail?.code;
        if (code === 'BOOKING_ALREADY_CLAIMED') {
          Alert.alert(
            'Already claimed',
            'Another care professional accepted this first. It has been removed from your list.',
          );
        } else if (code === 'WORKER_TIME_CONFLICT') {
          Alert.alert(
            'Schedule clash',
            'You already have another visit booked during this time slot.',
          );
        } else if (code === 'BOOKING_NOT_AVAILABLE') {
          Alert.alert('No longer available', 'This request has been withdrawn.');
        } else {
          Alert.alert('Could not accept', e?.message || 'Please try again.');
        }
      }
    });

  const cancel = (b: Booking) => {
    if (!canNurseCancel(b)) {
      Alert.alert('Cancellation closed', CANCELLATION_CLOSED_MESSAGE);
      return;
    }
    Alert.alert(
      'Cancel this visit?',
      'The visit will be offered to other qualified nurses straight away, and the family will be told we’re finding a replacement. Repeated cancellations affect your rating.',
      [
        { text: 'Keep visit', style: 'cancel' },
        {
          text: 'Cancel visit',
          style: 'destructive',
          onPress: () =>
            withBusy(b.id, async () => {
              try {
                await cancelAPI(b.id, 'Cancelled by care professional');
              } catch (e: any) {
                const detail = e?.detail?.detail ?? e?.detail;
                Alert.alert(
                  'Could not cancel',
                  detail?.code === 'CANCELLATION_WINDOW_CLOSED'
                    ? CANCELLATION_CLOSED_MESSAGE
                    : e?.message || 'Please try again.',
                );
              }
            }),
        },
      ],
    );
  };

  const emptyCopy: Record<Tab, { title: string; description: string }> = {
    requests: {
      title: 'No open requests',
      description:
        eligibility.length > 0 && eligibleCount === 0
          ? 'You’re not eligible for any care package yet, so nothing can be offered to you. Check what’s outstanding under My services.'
          : 'New visits near you appear here as families book them. Staying marked available helps you see more.',
    },
    upcoming: {
      title: 'No upcoming visits',
      description: 'Accept a request and it’ll show up here with everything you need for the visit.',
    },
    past: {
      title: 'No past visits yet',
      description: 'Completed and cancelled visits are kept here for your records.',
    },
  };

  return (
    <SafeAreaView style={styles.safe} testID="assignments-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My visits" showBack={false} />

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count =
            t.id === 'requests' ? newRequests.length : t.id === 'upcoming' ? upcoming.length : 0;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
              testID={`tab-${t.id}`}
            >
              <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[styles.count, tab === t.id && styles.countActive]}>
                  <Text style={[styles.countTxt, tab === t.id && { color: '#fff' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <AsyncBoundary
        state={state}
        isEmpty={rows.length === 0}
        emptyTitle={emptyCopy[tab].title}
        emptyDescription={emptyCopy[tab].description}
        emptyIcon={tab === 'requests' ? 'notifications-outline' : 'calendar-outline'}
        emptyCtaTitle={
          tab === 'requests' && eligibility.length > 0 && eligibleCount === 0
            ? 'Check my services'
            : undefined
        }
        onEmptyCtaPress={() => router.push('/service-preferences')}
        onRetry={onRefresh}
      >
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <VisitRow
              booking={item}
              mode={tab}
              busy={busyIds.has(item.id)}
              onOpen={() =>
                router.push({ pathname: '/nurse-visit/[id]', params: { id: item.id } })
              }
              onAccept={() => accept(item)}
              onCancel={() => cancel(item)}
              onNavigate={() => setPendingNavBooking(item)}
            />
          )}
        />
      </AsyncBoundary>

      <NurseSafetyCheckModal
        visible={!!pendingNavBooking}
        bookingId={pendingNavBooking?.id ?? ''}
        onClose={() => {
          setPendingNavBooking(null);
          refreshAssignmentsAPI().catch(() => {});
        }}
        onEnRouteConfirmed={() => {
          if (pendingNavBooking) {
            openInMaps(pendingNavBooking.latitude, pendingNavBooking.longitude);
          }
          setPendingNavBooking(null);
          refreshAssignmentsAPI().catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

const VisitRow: React.FC<{
  booking: Booking;
  mode: Tab;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onNavigate: () => void;
}> = ({ booking, mode, busy, onOpen, onAccept, onCancel, onNavigate }) => {
  const cancellable = mode === 'upcoming' && canNurseCancel(booking);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={mode === 'requests' ? undefined : onOpen}
      testID={`visit-${booking.id}`}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.title}>{booking.careTitle}</Text>
          <Text style={styles.sub}>
            {formatDay(booking.date)} · {formatTime(booking.slot)} · {booking.duration}h
          </Text>
        </View>
        {mode === 'requests' ? (
          booking.isUrgent ? (
            <View style={styles.urgentChip}>
              <Ionicons name="flash" size={11} color={Colors.warning} />
              <Text style={styles.urgentTxt}>Urgent</Text>
            </View>
          ) : null
        ) : (
          <BookingStatusBadge status={booking.rawStatus} />
        )}
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
        <Text style={styles.address} numberOfLines={2}>
          {booking.address}
        </Text>
      </View>

      {typeof booking.distanceKm === 'number' && (
        <View style={styles.metaRow}>
          <Ionicons name="navigate-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.address}>{booking.distanceKm.toFixed(1)} km away</Text>
        </View>
      )}

      {!!booking.notes && (
        <View style={styles.notesBox}>
          <Text style={styles.notesTxt} numberOfLines={3}>
            {booking.notes}
          </Text>
        </View>
      )}

      {mode !== 'past' && booking.serviceOnlyWorkflow && (
        <View style={styles.suppliesChip}>
          <Ionicons
            name={booking.patientSupplyPhotoUrl ? 'camera' : 'alert-circle-outline'}
            size={13}
            color={booking.patientSupplyPhotoUrl ? Colors.primary : Colors.warning}
          />
          <Text style={styles.suppliesChipTxt}>
            {booking.patientSupplyPhotoUrl
              ? 'Patient supplies photo available — check before you travel'
              : 'No supplies photo uploaded yet'}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <View>
          <Text style={styles.payLabel}>Visit value</Text>
          <Text style={styles.pay}>{inr(booking.netCost)}</Text>
        </View>

        <View style={styles.btnRow}>
          {mode === 'requests' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={onAccept}
              disabled={busy}
              testID={`accept-${booking.id}`}
            >
              <Text style={styles.primaryTxt}>{busy ? 'Accepting…' : 'Accept'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={onNavigate} testID="navigate">
                <Ionicons name="navigate" size={17} color={Colors.primary} />
              </TouchableOpacity>
              {cancellable && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: Colors.errorBg }]}
                  onPress={onCancel}
                  disabled={busy}
                  testID={`cancel-${booking.id}`}
                >
                  <Ionicons name="close" size={17} color={Colors.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={onOpen}>
                <Text style={styles.primaryTxt}>Open</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {mode === 'upcoming' && !cancellable && !['completed', 'cancelled'].includes(booking.rawStatus) && (
        <Text style={styles.lockedTxt}>
          Cancellation window has closed — contact support if you can’t attend.
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
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
  tabTxtActive: { color: Colors.teal },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: { backgroundColor: Colors.teal },
  countTxt: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 3 },
  urgentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  urgentTxt: { ...Typography.caption, color: Colors.warning, fontWeight: '700' as const },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  address: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  notesBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 10,
  },
  notesTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 17 },
  suppliesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  suppliesChipTxt: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  payLabel: { ...Typography.caption, color: Colors.textTertiary },
  pay: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 2 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.teal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  primaryTxt: { ...Typography.small, color: '#fff', fontWeight: '700' as const },
  lockedTxt: { ...Typography.caption, color: Colors.textTertiary, marginTop: 10, lineHeight: 16 },
});
