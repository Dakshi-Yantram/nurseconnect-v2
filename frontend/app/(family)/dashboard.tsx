import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { GradientBanner } from '../../components/GradientBanner';
import { BookingCard } from '../../components/BookingCard';
import { OfflineBanner } from '../../components/OfflineBanner';

export default function FamilyDashboard() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const bookings = useStore((s) => s.bookings);
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;

  const upcoming = bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled');
  const totalSubsidy = bookings.reduce((s, b) => s + b.subsidy, 0);
  const totalSpent = bookings.reduce((s, b) => s + b.netCost, 0);

  const quickActions = [
    {
      icon: 'medical',
      label: 'Book Nurse',
      color: Colors.primary,
      onPress: () => router.push('/care-types'),
    },
    {
      icon: 'card',
      label: 'Payments',
      color: Colors.teal,
      onPress: () => router.push('/(family)/payments'),
    },
    {
      icon: 'heart',
      label: 'Care Notes',
      color: Colors.error,
      onPress: () => router.push('/(family)/visits'),
    },
    {
      icon: 'document-text',
      label: 'ABHA',
      color: Colors.accent,
      onPress: () => router.push('/abha'),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} testID="family-dashboard" edges={['top']}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Greeting */}
        <View style={styles.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.subHello}>How can we care for your family today?</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications')}
            testID="notifications-bell"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            {unread > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifDotTxt}>{unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(family)/profile')}
            testID="profile-avatar"
          >
            <Image
              source={{
                uri:
                  user?.avatar ||
                  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80',
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>

        {/* Hero stats */}
        <LinearGradient
          colors={Gradients.teal as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>This month’s care</Text>
            <Text style={styles.heroValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
            <View style={styles.heroPill}>
              <FontAwesome5 name="hand-holding-heart" size={11} color="#fff" />
              <Text style={styles.heroPillTxt}>
                ₹{totalSubsidy} saved via BPL subsidy
              </Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.heroLabel}>Care hours</Text>
            <Text style={styles.heroValue}>
              {bookings.reduce((s, b) => s + b.duration, 0)}h
            </Text>
            <Text style={[styles.heroPillTxt, { color: 'rgba(255,255,255,0.8)' }]}>
              Across {bookings.length} visits
            </Text>
          </View>
        </LinearGradient>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.qaRow}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.qaCard}
              onPress={a.onPress}
              testID={`quick-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <View style={[styles.qaIcon, { backgroundColor: a.color + '15' }]}>
                <Ionicons name={a.icon as any} size={20} color={a.color} />
              </View>
              <Text style={styles.qaLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming */}
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Active bookings</Text>
          <TouchableOpacity onPress={() => router.push('/(family)/visits')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <GradientBanner
            title="No active visits"
            subtitle="Book a verified nurse for your loved ones"
            ctaTitle="Book"
            icon="add-circle-outline"
            onPress={() => router.push('/care-types')}
          />
        ) : (
          upcoming.slice(0, 2).map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onPress={() =>
                b.status === 'enroute' || b.status === 'active'
                  ? router.push({ pathname: '/tracking/[id]', params: { id: b.id } })
                  : router.push({ pathname: '/visit/[id]', params: { id: b.id } })
              }
            />
          ))
        )}

        {/* ABHA banner */}
        <View style={{ marginTop: 8 }}>
          <GradientBanner
            title="Link your ABHA Health ID"
            subtitle="Seamlessly access all your health records"
            ctaTitle="Link"
            icon="shield-checkmark-outline"
            onPress={() => router.push('/abha')}
          />
        </View>

        {/* Recent activity */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent activity</Text>
        {notifications.slice(0, 3).map((n) => (
          <TouchableOpacity
            key={n.id}
            style={styles.activity}
            onPress={() => router.push('/notifications')}
          >
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: n.read ? Colors.surfaceAlt : Colors.infoBg },
              ]}
            >
              <Ionicons
                name={
                  n.type === 'payment'
                    ? 'card-outline'
                    : n.type === 'booking'
                    ? 'medkit-outline'
                    : 'information-circle-outline'
                }
                size={18}
                color={Colors.primary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actTitle} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={styles.actBody} numberOfLines={1}>
                {n.body}
              </Text>
            </View>
            <Text style={styles.actTime}>{n.time}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Floating Book button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/care-types')}
        testID="fab-book-nurse"
      >
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          <Text style={styles.fabTxt}>Book Nurse</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
  },
  hello: { ...Typography.h2, color: Colors.textPrimary, fontWeight: '800' as const },
  subHello: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    ...Shadows.card,
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDotTxt: { color: '#fff', fontSize: 9, fontWeight: '800' as const },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  hero: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.floating,
  },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...Typography.h1, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 6,
  },
  heroPillTxt: { ...Typography.small, color: '#fff', fontWeight: '600' as const, marginTop: 4 },
  heroDivider: { width: 1, height: 60, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.lg,
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  seeAll: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const, marginTop: 24, marginBottom: 12 },
  qaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.md },
  qaCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    margin: 4,
    ...Shadows.card,
  },
  qaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const, marginTop: 8, textAlign: 'center' },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  actBody: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  actTime: { ...Typography.caption, color: Colors.textTertiary },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.lg,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
    ...Shadows.floating,
  },
  fabTxt: { color: '#fff', ...Typography.bodyBold, fontWeight: '700' as const },
});

// Wrap families dashboard with bookings dependency
const _bookings: any[] = [];
const _setBookings = (_b: any[]) => {};
