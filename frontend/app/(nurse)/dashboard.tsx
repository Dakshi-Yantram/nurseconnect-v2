/**
 * Care professional home.
 *
 * Two things gate whether a nurse ever sees work, so both are surfaced here
 * rather than buried: onboarding approval, and being opted in to at least one
 * care package. A nurse with neither sees an empty "new requests" list and no
 * explanation, which is indistinguishable from there being no work.
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { OfflineBanner } from '../../components/OfflineBanner';
import { BookingCard } from '../../components/BookingCard';
import { AsyncBoundary } from '../../components/AsyncBoundary';
import { useStore } from '../../store';
import { inr } from '../../lib/format';

const AVAILABILITY: {
  id: 'online' | 'offline' | 'busy' | 'on_leave';
  label: string;
  color: string;
}[] = [
  { id: 'online', label: 'Available', color: Colors.success },
  { id: 'busy', label: 'Busy', color: Colors.warning },
  { id: 'offline', label: 'Offline', color: Colors.textSecondary },
  { id: 'on_leave', label: 'On leave', color: Colors.accent },
];

export default function NurseDashboard() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const assignments = useStore((s) => s.assignments);
  const newRequests = useStore((s) => s.newRequests);
  const kit = useStore((s) => s.kit);
  const earnings = useStore((s) => s.earnings);
  const eligibility = useStore((s) => s.eligibility);
  const workerProfile = useStore((s) => s.workerProfile);
  const onboarding = useStore((s) => s.onboarding);
  const notifications = useStore((s) => s.notifications);
  const state = useStore((s) => s.loadState.assignments);
  const bootstrapNurse = useStore((s) => s.bootstrapNurse);
  const loadEligibilityAPI = useStore((s) => s.loadEligibilityAPI);
  const updateAvailabilityAPI = useStore((s) => s.updateAvailabilityAPI);

  const [refreshing, setRefreshing] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  useFocusEffect(
    useCallback(() => {
      bootstrapNurse().catch(() => {});
      loadEligibilityAPI().catch(() => {});
    }, [bootstrapNurse, loadEligibilityAPI]),
  );

  const unread = notifications.filter((n) => !n.read).length;

  const todayYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }, []);

  const todaysVisits = assignments.filter(
    (a) => a.date === todayYmd && !['completed', 'cancelled', 'missed'].includes(a.rawStatus),
  );
  const activeVisit = assignments.find((a) => a.rawStatus === 'in_progress') ?? null;
  const completedCount = assignments.filter((a) => a.rawStatus === 'completed').length;

  const kitDone = kit.filter((k) => k.checked).length;
  const kitPct = kit.length ? Math.round((kitDone / kit.length) * 100) : 0;

  // "Eligible" is what actually decides whether work reaches this nurse:
  // qualified for the offering AND not explicitly opted out of it.
  const eligibleCount = eligibility.filter(
    (e) => e.can_opt_in && e.preference_status === 'OPTED_IN',
  ).length;
  const approved = onboarding ? onboarding.onboarding_status === 'approved' : true;
  const availability = workerProfile?.availability ?? 'offline';

  const onRefresh = async () => {
    setRefreshing(true);
    await bootstrapNurse().catch(() => {});
    setRefreshing(false);
  };

  const setAvailability = async (next: 'online' | 'offline' | 'busy' | 'on_leave') => {
    setSavingAvailability(true);
    try {
      await updateAvailabilityAPI(next);
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="nurse-dashboard" edges={['top']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ---------------------------------------------------- header --- */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.subHello}>
              {todaysVisits.length > 0
                ? `${todaysVisits.length} visit${todaysVisits.length === 1 ? '' : 's'} today`
                : 'No visits scheduled today'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/notifications')}
            testID="nurse-notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------ onboarding gate ---- */}
        {!approved && (
          <TouchableOpacity
            style={styles.blockCard}
            onPress={() => router.push('/onboarding-status')}
            testID="nurse-onboarding-gate"
          >
            <Ionicons name="shield-half" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockTitle}>
                {onboarding?.onboarding_status === 'pending_review'
                  ? 'Your profile is under review'
                  : 'Finish your verification'}
              </Text>
              <Text style={styles.blockSub}>
                {onboarding?.onboarding_status === 'pending_review'
                  ? 'We’ll let you know as soon as a reviewer approves you. You can’t accept visits until then.'
                  : 'Upload your documents to start receiving visit requests.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* ------------------------------------------- eligibility gate -- */}
        {approved && eligibility.length > 0 && eligibleCount === 0 && (
          <TouchableOpacity
            style={styles.blockCard}
            onPress={() => router.push('/service-preferences')}
            testID="nurse-eligibility-gate"
          >
            <Ionicons name="options" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockTitle}>No care packages open to you yet</Text>
              <Text style={styles.blockSub}>
                You’re not currently eligible for any package, so no visits can be offered. Check
                what’s outstanding — usually training or a certificate.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* ------------------------------------------------ availability -- */}
        {approved && (
          <View style={styles.availCard}>
            <Text style={styles.availLabel}>I’m currently</Text>
            <View style={styles.availRow}>
              {AVAILABILITY.map((a) => {
                const on = availability === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.availChip, on && { backgroundColor: a.color }]}
                    disabled={savingAvailability}
                    onPress={() => setAvailability(a.id)}
                    testID={`availability-${a.id}`}
                  >
                    <Text style={[styles.availTxt, on && { color: '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {availability !== 'online' && (
              <Text style={styles.availHint}>
                You’ll keep your accepted visits, but new requests only go to nurses marked
                available.
              </Text>
            )}
          </View>
        )}

        {/* --------------------------------------------- active visit ---- */}
        {!!activeVisit && (
          <TouchableOpacity
            style={styles.activeCard}
            onPress={() =>
              router.push({ pathname: '/nurse-visit/[id]', params: { id: activeVisit.id } })
            }
            testID="nurse-active-visit"
          >
            <View style={styles.activeIcon}>
              <MaterialCommunityIcons name="pulse" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.activeTitle}>Visit in progress</Text>
              <Text style={styles.activeSub}>{activeVisit.careTitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ---------------------------------------------------- stats ---- */}
        <View style={styles.statsRow}>
          <Stat
            value={String(newRequests.length)}
            label="New requests"
            onPress={() => router.push('/(nurse)/assignments')}
          />
          <Stat value={String(completedCount)} label="Completed" />
          <Stat
            value={inr(Number(earnings?.total_paid ?? 0))}
            label="Paid out"
            onPress={() => router.push('/earnings')}
          />
        </View>

        {/* ------------------------------------------------------ kit ---- */}
        {kit.length > 0 && (
          <TouchableOpacity
            style={styles.kitCard}
            onPress={() => router.push('/(nurse)/kit')}
            testID="nurse-kit"
          >
            <MaterialCommunityIcons
              name="medical-bag"
              size={20}
              color={kitPct === 100 ? Colors.success : Colors.warning}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.kitTitle}>
                Visit kit {kitDone}/{kit.length}
              </Text>
              <View style={styles.kitBar}>
                <View
                  style={[
                    styles.kitFill,
                    {
                      width: `${kitPct}%`,
                      backgroundColor: kitPct === 100 ? Colors.success : Colors.warning,
                    },
                  ]}
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* ------------------------------------------------ today list --- */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Today’s visits</Text>
          <TouchableOpacity onPress={() => router.push('/(nurse)/assignments')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: Spacing.lg }}>
          <AsyncBoundary
            state={state}
            isEmpty={todaysVisits.length === 0}
            emptyTitle="Nothing scheduled today"
            emptyDescription={
              newRequests.length > 0
                ? `There ${newRequests.length === 1 ? 'is' : 'are'} ${newRequests.length} open request${newRequests.length === 1 ? '' : 's'} you can claim.`
                : approved
                  ? 'New requests near you will appear here as they come in.'
                  : 'Once your profile is approved you’ll start receiving requests.'
            }
            emptyIcon="calendar-outline"
            emptyCtaTitle={newRequests.length > 0 ? 'View requests' : undefined}
            onEmptyCtaPress={() => router.push('/(nurse)/assignments')}
            onRetry={() => bootstrapNurse()}
          >
            {todaysVisits.map((v) => (
              <BookingCard
                key={v.id}
                booking={v}
                onPress={() =>
                  router.push({ pathname: '/nurse-visit/[id]', params: { id: v.id } })
                }
              />
            ))}
          </AsyncBoundary>
        </View>

        {/* --------------------------------------------------- shortcuts - */}
        <View style={styles.shortcutRow}>
          <Shortcut
            icon="school-outline"
            label="Training"
            onPress={() => router.push('/training')}
          />
          <Shortcut
            icon="clipboard-outline"
            label="Assessments"
            onPress={() => router.push('/assessments')}
          />
          <Shortcut
            icon="options-outline"
            label="My services"
            onPress={() => router.push('/service-preferences')}
          />
          <Shortcut
            icon="help-buoy-outline"
            label="Help"
            onPress={() => router.push('/support')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ value: string; label: string; onPress?: () => void }> = ({
  value,
  label,
  onPress,
}) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} disabled={!onPress}>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const Shortcut: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.shortcut} onPress={onPress} testID={`shortcut-${label}`}>
    <View style={styles.shortcutIcon}>
      <Ionicons name={icon} size={20} color={Colors.teal} />
    </View>
    <Text style={styles.shortcutTxt}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  hello: { ...Typography.h2, color: Colors.textPrimary },
  subHello: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
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
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.lg,
    padding: 14,
  },
  blockTitle: { ...Typography.bodyBold, color: Colors.warning },
  blockSub: { ...Typography.small, color: Colors.warning, marginTop: 2, lineHeight: 17 },
  availCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  availLabel: { ...Typography.small, color: Colors.textSecondary, marginBottom: 10 },
  availRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  availChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
  },
  availTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  availHint: { ...Typography.caption, color: Colors.textTertiary, marginTop: 10, lineHeight: 16 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.teal,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    ...Shadows.floating,
  },
  activeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: { ...Typography.bodyBold, color: '#fff' },
  activeSub: { ...Typography.small, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  statValue: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '800' as const },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  kitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  kitTitle: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  kitBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceAlt,
    marginTop: 8,
    overflow: 'hidden',
  },
  kitFill: { height: 6, borderRadius: 3 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary },
  seeAll: { ...Typography.small, color: Colors.teal, fontWeight: '700' as const },
  shortcutRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  shortcut: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    ...Shadows.card,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTxt: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' as const },
});
