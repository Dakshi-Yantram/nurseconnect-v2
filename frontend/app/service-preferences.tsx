import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import {
  workersService,
  ServiceEligibilityItem,
  PreferenceStatus,
} from '../services/workers.service';

type Tab = 'available' | 'opted_in' | 'locked' | 'opted_out';

const TAB_TITLES: Record<Tab, string> = {
  available: 'Available',
  opted_in: 'Opted in',
  locked: 'Locked',
  opted_out: 'Opted out',
};

function bucketOf(item: ServiceEligibilityItem): Tab {
  if (item.preference_status === 'OPTED_IN') return 'opted_in';
  if (!item.can_opt_in) return 'locked';
  if (item.preference_status === 'OPTED_OUT' || item.preference_status === 'PAUSED') {
    // Distinguish "Available to opt in" from "Opted out": if record has never
    // been opted-out by user (still default OPTED_OUT but no notes), show as Available.
    // For simplicity: anything qualified but not opted_in → available.
    return 'available';
  }
  return 'available';
}

function humanLockedReason(r: string | null): string {
  if (!r) return 'Locked';
  switch (r) {
    case 'TRAINING_REQUIRED':
      return 'Training required';
    case 'CERTIFICATE_REQUIRED':
      return 'Certificate required';
    case 'ADMIN_APPROVAL_REQUIRED':
      return 'Admin approval pending';
    case 'TIER_TOO_LOW':
      return 'Tier too low';
    case 'WORKER_NOT_VERIFIED':
      return 'Profile not verified yet';
    case 'WORKER_INACTIVE':
      return 'Account inactive';
    case 'QUALIFICATION_RECORD_MISSING':
      return 'Awaiting platform approval';
    case 'QUALIFICATION_EXPIRED':
      return 'Qualification expired';
    default:
      if (r.startsWith('QUALIFICATION_STATUS_')) {
        return r.replace('QUALIFICATION_STATUS_', '').replace(/_/g, ' ').toLowerCase();
      }
      return r.replace(/_/g, ' ').toLowerCase();
  }
}

export default function ServicePreferencesScreen() {
  const [items, setItems] = useState<ServiceEligibilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('opted_in');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await workersService.getServiceEligibility();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Unable to load', e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buckets = useMemo(() => {
    const grouped: Record<Tab, ServiceEligibilityItem[]> = {
      available: [],
      opted_in: [],
      locked: [],
      opted_out: [],
    };
    for (const it of items) grouped[bucketOf(it)].push(it);
    return grouped;
  }, [items]);

  const setPreference = useCallback(
    async (item: ServiceEligibilityItem, status: PreferenceStatus) => {
      setPendingId(item.id);
      try {
        const updated = await workersService.updateServicePreference({
          target_type: item.target_type,
          target_id: item.id,
          preference_status: status,
        });
        setItems((arr) => arr.map((x) => (x.id === item.id ? updated : x)));
      } catch (e: any) {
        const detail = e?.detail?.detail || e?.detail;
        const code = detail?.code || e?.detail?.code;
        const reason = detail?.locked_reason || detail?.message;
        Alert.alert(
          code === 'WORKER_NOT_QUALIFIED_FOR_SERVICE' ? 'Not qualified yet' : 'Update failed',
          reason || e?.message || 'Please try again',
        );
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  const renderCard = (it: ServiceEligibilityItem) => {
    const isPending = pendingId === it.id;
    const tier = it.min_tier ? it.min_tier.toUpperCase() : '';
    const optedIn = it.preference_status === 'OPTED_IN';
    return (
      <View
        key={it.id}
        style={styles.card}
        testID={`service-pref-card-${it.code}`}
      >
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{it.name}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.tag, styles.tagNeutral]}>
                <Text style={styles.tagTxt}>{it.target_type === 'package' ? 'Package' : 'Service'}</Text>
              </View>
              {tier ? (
                <View style={[styles.tag, styles.tagNeutral]}>
                  <Text style={styles.tagTxt}>Min {tier}</Text>
                </View>
              ) : null}
              {it.risk_level && it.risk_level !== 'LOW' ? (
                <View
                  style={[
                    styles.tag,
                    it.risk_level === 'CRITICAL'
                      ? styles.tagDanger
                      : it.risk_level === 'HIGH'
                        ? styles.tagWarn
                        : styles.tagInfo,
                  ]}
                >
                  <Text style={styles.tagTxtLight}>{it.risk_level}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              optedIn
                ? styles.statusOptedIn
                : !it.can_opt_in
                  ? styles.statusLocked
                  : styles.statusAvailable,
            ]}
          >
            <Text style={styles.statusPillTxt}>
              {optedIn
                ? 'OPTED IN'
                : !it.can_opt_in
                  ? 'LOCKED'
                  : it.preference_status === 'OPTED_OUT'
                    ? 'OPTED OUT'
                    : 'AVAILABLE'}
            </Text>
          </View>
        </View>

        {!it.can_opt_in && it.locked_reason ? (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed" size={14} color={Colors.warning} />
            <Text style={styles.lockedTxt}>{humanLockedReason(it.locked_reason)}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {optedIn ? (
            <TouchableOpacity
              disabled={isPending}
              onPress={() => setPreference(it, 'OPTED_OUT')}
              style={[styles.btn, styles.btnSecondary]}
              testID={`service-pref-optout-${it.code}`}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Text style={styles.btnSecondaryTxt}>Opt out</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              disabled={isPending || !it.can_opt_in}
              onPress={() => setPreference(it, 'OPTED_IN')}
              style={[
                styles.btn,
                it.can_opt_in ? styles.btnPrimary : styles.btnDisabled,
              ]}
              testID={`service-pref-optin-${it.code}`}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryTxt}>
                  {it.can_opt_in ? 'Opt in' : 'Locked'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const tabKeys: Tab[] = ['opted_in', 'available', 'locked', 'opted_out'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="service-preferences-screen">
      <Header title="Services I Accept" />
      <View style={styles.tabBar}>
        {tabKeys.map((t) => {
          const count = buckets[t].length;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => setActiveTab(t)}
              testID={`service-pref-tab-${t}`}
            >
              <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>
                {TAB_TITLES[t]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
          testID="service-pref-scroll"
        >
          {buckets[activeTab].length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={48}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptyTxt}>No items in this list.</Text>
            </View>
          ) : (
            buckets[activeTab].map(renderCard)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgApp,
  },
  tabActive: { backgroundColor: Colors.teal },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  tabTxtActive: { color: '#fff' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  tagNeutral: { backgroundColor: Colors.bgApp },
  tagInfo: { backgroundColor: Colors.teal },
  tagWarn: { backgroundColor: Colors.warning },
  tagDanger: { backgroundColor: Colors.error },
  tagTxt: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' as const },
  tagTxtLight: { fontSize: 11, color: '#fff', fontWeight: '700' as const },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  statusOptedIn: { backgroundColor: '#DCFCE7' },
  statusLocked: { backgroundColor: '#FEF3C7' },
  statusAvailable: { backgroundColor: '#E0F2FE' },
  statusPillTxt: { fontSize: 10, fontWeight: '800' as const, color: Colors.textPrimary },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: Radius.md,
    marginTop: 10,
  },
  lockedTxt: { ...Typography.small, color: Colors.textPrimary, textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: Colors.teal },
  btnSecondary: { backgroundColor: Colors.bgApp, borderWidth: 1, borderColor: Colors.border },
  btnDisabled: { backgroundColor: Colors.border },
  btnPrimaryTxt: { color: '#fff', fontWeight: '700' as const },
  btnSecondaryTxt: { color: Colors.textPrimary, fontWeight: '700' as const },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { ...Typography.body, color: Colors.textSecondary },
});
