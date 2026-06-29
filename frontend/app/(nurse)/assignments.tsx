import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { EmptyState } from '../../components/EmptyState';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

// Patch 3 — pure deep link to the consumer's Google Maps app. No backend
// SDK / API key is involved here.
function openInGoogleMaps(lat?: number, lng?: number, label?: string) {
  if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
    Alert.alert('Location unavailable', 'No coordinates on file for this booking.');
    return;
  }
  const q = `${lat},${lng}`;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${label ? `&query_place_id=${encodeURIComponent(label)}` : ''}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open Google Maps'));
}

export default function Assignments() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'today' | 'requests' | 'past'>(
    tabParam === 'past' ? 'past' : tabParam === 'requests' ? 'requests' : 'today'
  );
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const assignments = useStore((s) => s.assignments);
  const newRequests = useStore((s) => s.newRequests);
  const refreshAssignmentsAPI = useStore((s) => s.refreshAssignmentsAPI);
  const refreshNewRequestsAPI = useStore((s) => s.refreshNewRequestsAPI);
  const acceptAPI = useStore((s) => s.acceptAssignmentAPI);
  const cancelAPI = useStore((s) => s.cancelAssignmentAPI);
  const declineLocal = useStore((s) => s.declineRequest);

  // Refresh on focus + when switching tabs
  useFocusEffect(
    React.useCallback(() => {
      refreshAssignmentsAPI().catch(() => {});
      refreshNewRequestsAPI().catch(() => {});
    }, [refreshAssignmentsAPI, refreshNewRequestsAPI])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refreshAssignmentsAPI(), refreshNewRequestsAPI()]);
    setRefreshing(false);
  };

  const handleAccept = async (id: string) => {
    if (acceptingIds.has(id)) return; // prevent double-tap
    setAcceptingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await acceptAPI(id);
      // Only after backend confirms success.
      Alert.alert('Accepted', 'Assignment moved to today’s schedule');
    } catch (e: any) {
      const code = e?.detail?.code;
      if (code === 'BOOKING_ALREADY_CLAIMED') {
        Alert.alert(
          'Already claimed',
          'This booking has already been claimed by another care professional.'
        );
      } else if (code === 'WORKER_TIME_CONFLICT') {
        Alert.alert('Time conflict', 'You already have another booking during this time.');
      } else if (code === 'BOOKING_NOT_AVAILABLE') {
        Alert.alert('Unavailable', 'This request is no longer available.');
      } else if (code === 'WORKER_NOT_QUALIFIED_FOR_SERVICE') {
        Alert.alert(
          'Not qualified',
          'You are not yet qualified for this service. Please complete the required training or wait for admin approval.'
        );
      } else if (code === 'WORKER_NOT_OPTED_IN_FOR_SERVICE') {
        Alert.alert(
          'Not opted in',
          'You have not opted in to receive this service. Update your service preferences first.'
        );
      } else {
        Alert.alert('Could not accept', e?.message || 'Please try again.');
      }
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Sync tab if param changes (e.g., when redirected from visit-success)
  useEffect(() => {
    if (tabParam === 'past' && tab !== 'past') setTab('past');
  }, [tabParam]);

  const todayList = assignments.filter((a) => a.status !== 'completed' && a.status !== 'cancelled');
  const pastList = assignments
    .filter((a) => a.status === 'completed' || a.status === 'cancelled')
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const data = tab === 'today' ? todayList : tab === 'past' ? pastList : newRequests;

  return (
    <SafeAreaView style={styles.safe} testID="assignments-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My Assignments" showBack={false} />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'today' && styles.tabActive]}
          onPress={() => setTab('today')}
          testID="tab-today"
        >
          <Text style={[styles.tabTxt, tab === 'today' && { color: Colors.teal }]} numberOfLines={1}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
          testID="tab-requests"
        >
          <Text style={[styles.tabTxt, tab === 'requests' && { color: Colors.teal }]} numberOfLines={1}>
            Requests {newRequests.length > 0 ? `(${newRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
          testID="tab-past"
        >
          <Text style={[styles.tabTxt, tab === 'past' && { color: Colors.teal }]} numberOfLines={1}>
            Past {pastList.length > 0 ? `(${pastList.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <EmptyState
          title={
            tab === 'today'
              ? 'All clear!'
              : tab === 'requests'
              ? 'No new requests'
              : 'No past visits yet'
          }
          description={
            tab === 'today'
              ? 'No visits scheduled today.'
              : tab === 'requests'
              ? 'You’re all caught up.'
              : 'Completed visits will appear here.'
          }
          icon="checkmark-circle-outline"
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={tab === 'past' ? 0.7 : 1}
              onPress={
                tab === 'past'
                  ? () => router.push({ pathname: '/nurse-visit/[id]', params: { id: item.id } })
                  : undefined
              }
              style={styles.card}
              testID={tab === 'past' ? `past-visit-${item.id}` : undefined}
            >
              <View style={styles.row}>
                <View
                  style={[
                    styles.timeChip,
                    tab === 'past' && { backgroundColor: Colors.successBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeChipTxt,
                      tab === 'past' && { color: Colors.success },
                    ]}
                  >
                    {tab === 'past' ? 'Done' : item.slot}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title}>{item.careTitle}</Text>
                  <Text style={styles.sub}>
                    {new Date(item.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    · {item.duration}h{tab === 'past' ? ` · ${item.slot}` : ''}
                  </Text>
                </View>
                <Text style={styles.amount}>₹{item.netCost}</Text>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.address} numberOfLines={1}>
                  {item.address}
                </Text>
                {/* Patch 3 — optional distance chip (only when backend provided distance_km). */}
                {typeof item.distanceKm === 'number' && (
                  <View style={styles.distanceChip} testID={`distance-${item.id}`}>
                    <MaterialCommunityIcons name="map-marker-distance" size={12} color={Colors.primary} />
                    <Text style={styles.distanceChipTxt}>{item.distanceKm.toFixed(1)} km</Text>
                  </View>
                )}
              </View>
              {item.notes && tab !== 'past' && (
                <View style={styles.notesRow}>
                  <MaterialCommunityIcons name="note-text-outline" size={14} color={Colors.warning} />
                  <Text style={styles.notes}>{item.notes}</Text>
                </View>
              )}
              {tab !== 'past' && (
                <View style={styles.actions}>
                  {tab === 'today' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.successBg }]}
                        onPress={() =>
                          Alert.alert('Calling patient', `Connecting to ${item.address}…`)
                        }
                        testID={`call-${item.id}`}
                      >
                        <Ionicons name="call" size={16} color={Colors.success} />
                        <Text style={[styles.actionTxt, { color: Colors.success }]}>Call</Text>
                      </TouchableOpacity>
                      {/* Patch 3 — Google Maps deep link on assigned booking. */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.infoBg }]}
                        onPress={() => openInGoogleMaps(item.latitude, item.longitude, item.address)}
                        testID={`maps-${item.id}`}
                      >
                        <Ionicons name="navigate" size={16} color={Colors.primary} />
                        <Text style={[styles.actionTxt, { color: Colors.primary }]}>Maps</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.teal }]}
                        onPress={() =>
                          router.push({ pathname: '/nurse-visit/[id]', params: { id: item.id } })
                        }
                        testID={`view-${item.id}`}
                      >
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                        <Text style={[styles.actionTxt, { color: '#fff' }]}>View visit</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.errorBg }]}
                        onPress={() => declineLocal(item.id)}
                        testID={`decline-${item.id}`}
                      >
                        <Ionicons name="close" size={16} color={Colors.error} />
                        <Text style={[styles.actionTxt, { color: Colors.error }]}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: Colors.success },
                          acceptingIds.has(item.id) && { opacity: 0.6 },
                        ]}
                        disabled={acceptingIds.has(item.id)}
                        onPress={() => handleAccept(item.id)}
                        testID={`accept-${item.id}`}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={[styles.actionTxt, { color: '#fff' }]}>
                          {acceptingIds.has(item.id) ? 'Accepting…' : 'Accept'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
              {tab === 'past' && (
                <View style={styles.pastFooter}>
                  <View style={styles.pastBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.pastBadgeTxt}>Care notes saved</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginVertical: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 12, ...Shadows.card },
  row: { flexDirection: 'row', alignItems: 'center' },
  timeChip: { backgroundColor: Colors.infoBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md },
  timeChipTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  amount: { ...Typography.h4, color: Colors.success, fontWeight: '800' as const },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  address: { ...Typography.small, color: Colors.textTertiary, flex: 1 },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginLeft: 6,
  },
  distanceChipTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const, fontSize: 11 },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.warningBg,
    padding: 8,
    borderRadius: Radius.sm,
  },
  notes: { ...Typography.small, color: Colors.warning, flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    gap: 6,
  },
  actionTxt: { ...Typography.bodyBold, fontWeight: '700' as const },
  pastFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  pastBadgeTxt: { ...Typography.small, color: Colors.success, fontWeight: '700' as const },
});
