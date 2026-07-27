/**
 * Care package picker — the first step of booking.
 *
 * Packages are the only bookable unit (the backend's booking API takes a
 * `package_id`), and their prices come straight from what admin configured, so
 * nothing here is hardcoded. This screen previously listed four made-up care
 * types with invented prices that no booking could ever reference.
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
import { Header } from '../components/Header';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { inr, humanize } from '../lib/format';
import type { CarePackageOut } from '../services/catalog.service';

export default function CareTypes() {
  const router = useRouter();
  const packages = useStore((s) => s.packages);
  const state = useStore((s) => s.loadState.packages);
  const loadPackages = useStore((s) => s.loadPackages);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPackages().catch(() => {});
    }, [loadPackages]),
  );

  const active = useMemo(() => packages.filter((p) => p.is_active), [packages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPackages().catch(() => {});
    setRefreshing(false);
  };

  const choose = (pkg: CarePackageOut) => {
    router.push({ pathname: '/booking', params: { packageId: pkg.id } });
  };

  return (
    <SafeAreaView style={styles.safe} testID="care-types-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="What care do you need?" fallbackHref="/(family)/dashboard" />

      <AsyncBoundary
        state={state}
        isEmpty={active.length === 0}
        emptyTitle="No care packages available"
        emptyDescription="There are no packages open for booking in your area right now. Please check back shortly."
        emptyIcon="medkit-outline"
        onRetry={() => loadPackages()}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.intro}>
            Choose a care package. We’ll match you with a verified nurse nearby once your booking
            is confirmed.
          </Text>

          {active.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onPress={() => choose(pkg)} />
          ))}
        </ScrollView>
      </AsyncBoundary>
    </SafeAreaView>
  );
}

const PackageCard: React.FC<{ pkg: CarePackageOut; onPress: () => void }> = ({ pkg, onPress }) => {
  // Package price is the headline where one is set; otherwise it's billed per
  // visit. Showing both would misrepresent what the consumer actually pays.
  const packagePrice = parseFloat(pkg.package_price ?? '');
  const perVisit = parseFloat(pkg.per_visit_price ?? '');
  const hasPackagePrice = !isNaN(packagePrice) && packagePrice > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      testID={`package-${pkg.id}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.iconWrap}>
          <Ionicons name="medkit" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{pkg.name}</Text>
          {!!pkg.tagline && <Text style={styles.tagline}>{pkg.tagline}</Text>}
        </View>
      </View>

      {!!pkg.description && (
        <Text style={styles.desc} numberOfLines={3}>
          {pkg.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        {!!pkg.visit_frequency && (
          <Meta icon="repeat-outline" text={humanize(pkg.visit_frequency)} />
        )}
        {!!pkg.visits_per_cycle && (
          <Meta icon="calendar-outline" text={`${pkg.visits_per_cycle} visits`} />
        )}
        {!!pkg.shift_hours && <Meta icon="time-outline" text={`${pkg.shift_hours}h shift`} />}
        {pkg.subsidy_eligible && <Meta icon="ribbon-outline" text="Subsidy eligible" />}
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>{hasPackagePrice ? 'Package price' : 'Per visit'}</Text>
          <Text style={styles.price}>{inr(hasPackagePrice ? packagePrice : perVisit)}</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaTxt}>Book</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const Meta: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.meta}>
    <Ionicons name={icon} size={13} color={Colors.textSecondary} />
    <Text style={styles.metaTxt}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 21,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.h4, color: Colors.textPrimary },
  tagline: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  desc: { ...Typography.small, color: Colors.textSecondary, marginTop: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' as const },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  priceLabel: { ...Typography.caption, color: Colors.textTertiary },
  price: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  ctaTxt: { ...Typography.small, color: '#fff', fontWeight: '700' as const },
});
