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
import {
  packageMaterialsService,
  type PackageGroup,
} from '../services/package-materials.service';

export default function CareTypes() {
  const router = useRouter();
  const packages = useStore((s) => s.packages);
  const state = useStore((s) => s.loadState.packages);
  const loadPackages = useStore((s) => s.loadPackages);
  const [refreshing, setRefreshing] = useState(false);
  // Grouped catalogue (dropdowns). null = backend doesn't have the feature
  // (production) -> render the old flat list exactly as before.
  const [groups, setGroups] = useState<PackageGroup[] | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await packageMaterialsService.listGrouped());
    } catch {
      setGroups(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPackages().catch(() => {});
      loadGroups();
    }, [loadPackages, loadGroups]),
  );

  const active = useMemo(() => packages.filter((p) => p.is_active), [packages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPackages().catch(() => {}), loadGroups()]);
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

          {groups
            ? groups.map((g) => (
                <GroupCard
                  key={`${g.type}:${g.heading}:${g.options[0]?.id}`}
                  group={g}
                  packages={active}
                  onChoose={choose}
                />
              ))
            : active.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} onPress={() => choose(pkg)} />
              ))}
        </ScrollView>
      </AsyncBoundary>
    </SafeAreaView>
  );
}

/**
 * Similar packages (same Dropdown Heading in the catalogue sheet, e.g.
 * "Nursing Shift Duration": 4h / 8h / 12h Day …) render as ONE card with an
 * inline dropdown. Picking an option swaps the card to that package's price
 * and details; "Book" books the selected option.
 */
const GroupCard: React.FC<{
  group: PackageGroup;
  packages: CarePackageOut[];
  onChoose: (pkg: CarePackageOut) => void;
}> = ({ group, packages, onChoose }) => {
  // Only options the store also has (active + full details) are bookable.
  const options = group.options
    .map((o) => ({ o, pkg: packages.find((p) => p.id === o.id) }))
    .filter((x): x is { o: PackageGroup['options'][number]; pkg: CarePackageOut } => !!x.pkg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;

  const current = options.find((x) => x.o.id === selectedId) ?? options[0];

  if (group.type !== 'dropdown' || options.length === 1) {
    return <PackageCard pkg={current.pkg} onPress={() => onChoose(current.pkg)} />;
  }

  const selector = (
    <View style={styles.ddWrap}>
      <TouchableOpacity
        style={[styles.ddBox, open && styles.ddBoxOpen]}
        activeOpacity={0.8}
        onPress={() => setOpen((v) => !v)}
        testID={`group-${group.heading}-dropdown`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.ddLabel}>{group.heading}</Text>
          <Text style={styles.ddValue}>{current.o.dropdown_option || current.pkg.name}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.ddList}>
          {options.map(({ o, pkg }) => {
            const sel = o.id === current.o.id;
            const pp = parseFloat(pkg.package_price ?? '');
            const pv = parseFloat(pkg.per_visit_price ?? '');
            const price = !isNaN(pp) && pp > 0 ? pp : pv;
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.ddItem, sel && styles.ddItemOn]}
                onPress={() => {
                  setSelectedId(o.id);
                  setOpen(false);
                }}
                testID={`group-option-${o.id}`}
              >
                <Ionicons
                  name={sel ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={sel ? Colors.primary : Colors.textTertiary}
                />
                <Text style={styles.ddItemTxt}>{o.dropdown_option || pkg.name}</Text>
                {!isNaN(price) && price > 0 && <Text style={styles.ddItemPrice}>{inr(price)}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <PackageCard
      pkg={current.pkg}
      onPress={() => onChoose(current.pkg)}
      selector={selector}
    />
  );
};

/**
 * Collapsed card answers "what is this and is it relevant to me?"; tapping
 * "View details" expands the SAME card inline (not a new screen) to answer
 * "exactly what am I getting if I book this?". "Book" always sits next to
 * the toggle so booking never requires opening details first.
 */
const PackageCard: React.FC<{
  pkg: CarePackageOut;
  onPress: () => void;
  /** Optional dropdown rendered under the title (grouped packages). */
  selector?: React.ReactNode;
}> = ({ pkg, onPress, selector }) => {
  const [expanded, setExpanded] = useState(false);

  // Package price is the headline where one is set; otherwise it's billed per
  // visit. Showing both would misrepresent what the consumer actually pays.
  const packagePrice = parseFloat(pkg.package_price ?? '');
  const perVisit = parseFloat(pkg.per_visit_price ?? '');
  const hasPackagePrice = !isNaN(packagePrice) && packagePrice > 0;

  const hasDetails =
    (pkg.whats_included?.length ?? 0) > 0 ||
    !!pkg.service_details_text ||
    !!pkg.important_information;

  return (
    <View style={styles.card} testID={`package-${pkg.id}`}>
      <View style={styles.cardHead}>
        <View style={styles.iconWrap}>
          <Ionicons name="medkit" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{pkg.name}</Text>
          {!!pkg.tagline && <Text style={styles.tagline}>{pkg.tagline}</Text>}
        </View>
      </View>

      {selector}

      {!!pkg.description && (
        <Text style={styles.desc} numberOfLines={expanded ? undefined : 3}>
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

      {expanded && hasDetails && (
        <View style={styles.detailsPane}>
          {(pkg.whats_included?.length ?? 0) > 0 && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>What's included</Text>
              {pkg.whats_included!.map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>{'\u2022'}</Text>
                  <Text style={styles.bulletTxt}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {!!pkg.service_details_text && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>Service details</Text>
              <Text style={styles.detailBody}>{pkg.service_details_text}</Text>
            </View>
          )}

          {!!pkg.important_information && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailHeading}>Important information</Text>
              <Text style={styles.detailBody}>{pkg.important_information}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>{hasPackagePrice ? 'Package price' : 'Per visit'}</Text>
          <Text style={styles.price}>{inr(hasPackagePrice ? packagePrice : perVisit)}</Text>
        </View>

        <View style={styles.actionsRow}>
          {hasDetails && (
            <TouchableOpacity
              style={styles.viewDetailsBtn}
              activeOpacity={0.7}
              onPress={() => setExpanded((v) => !v)}
              testID={`package-${pkg.id}-toggle-details`}
            >
              <Text style={styles.viewDetailsTxt}>
                {expanded ? 'View less' : 'View details'}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Colors.primary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={onPress}
            testID={`package-${pkg.id}-book`}
          >
            <Text style={styles.ctaTxt}>Book</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  viewDetailsTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
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
  // Expanded card content — an inline extension of the same card, not a new
  // screen. Sits between the metadata row and the price/actions footer.
  detailsPane: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.sm,
  },
  detailBlock: { marginBottom: 10 },
  detailHeading: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  detailBody: { ...Typography.small, color: Colors.textSecondary, lineHeight: 19 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { ...Typography.small, color: Colors.textSecondary, marginRight: 6 },
  bulletTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 19, flex: 1 },
  // Grouped-package dropdown (same palette as the booking screen selectors).
  ddWrap: { marginTop: 12 },
  ddBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  ddBoxOpen: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  ddLabel: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '600' as const },
  ddValue: { ...Typography.bodyBold, color: Colors.textPrimary, fontSize: 15, marginTop: 2 },
  ddList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  ddItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  ddItemOn: { backgroundColor: '#EFF6FF' },
  ddItemTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  ddItemPrice: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
