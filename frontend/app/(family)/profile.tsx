/**
 * Consumer profile and account settings.
 *
 * Counts shown here are read from the store rather than invented, and there's
 * no "Aarav Kumar" fallback name — an unnamed account says so and offers to
 * fix it.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const patients = useStore((s) => s.patients);
  const addresses = useStore((s) => s.addresses);
  const familyMembers = useStore((s) => s.familyMembers);
  const bookings = useStore((s) => s.bookings);
  const loadPatients = useStore((s) => s.loadPatients);
  const loadAddresses = useStore((s) => s.loadAddresses);
  const loadFamilyMembers = useStore((s) => s.loadFamilyMembers);
  const logout = useStore((s) => s.logout);

  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    await Promise.allSettled([loadPatients(), loadAddresses(), loadFamilyMembers()]);
  }, [loadPatients, loadAddresses, loadFamilyMembers]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const completedVisits = bookings.filter((b) => b.rawStatus === 'completed').length;
  const needsName = !user?.name?.trim();

  const items = [
    {
      icon: 'people-outline' as const,
      title: 'Patients',
      sub: patients.length ? `${patients.length} on file` : 'Add who you book care for',
      onPress: () => router.push('/patients'),
      highlight: patients.length === 0,
    },
    {
      icon: 'location-outline' as const,
      title: 'Addresses',
      sub: addresses.length ? `${addresses.length} saved` : 'Add a service address',
      onPress: () => router.push('/addresses'),
      highlight: addresses.length === 0,
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Consents',
      sub: 'Care, photos and records',
      onPress: () => router.push('/consents'),
    },
    {
      icon: 'people-circle-outline' as const,
      title: 'Family members',
      sub: familyMembers.length ? `${familyMembers.length} added` : 'Share updates with family',
      onPress: () => router.push('/family-members'),
    },
    {
      icon: 'document-text-outline' as const,
      title: 'Health records',
      sub: 'ABHA and linked documents',
      onPress: () => router.push('/abha'),
    },
    {
      icon: 'card-outline' as const,
      title: 'Payments',
      sub: 'Receipts and refunds',
      onPress: () => router.push('/(family)/payments'),
    },
    {
      icon: 'notifications-outline' as const,
      title: 'Notifications',
      sub: 'Visit and payment updates',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'person-outline' as const,
      title: 'Edit profile',
      sub: 'Emergency contact',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'help-buoy-outline' as const,
      title: 'Help & support',
      sub: 'FAQs and requests',
      onPress: () => router.push('/support'),
    },
    {
      icon: 'lock-closed-outline' as const,
      title: 'Privacy',
      sub: 'How your data is used',
      onPress: () => router.push('/privacy'),
    },
  ];

  const signOut = () => {
    Alert.alert('Sign out?', 'You’ll need to sign in again to see your bookings.', [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/role-select');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Profile" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
      >
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.name}>{needsName ? 'Add your name' : user!.name}</Text>
          <Text style={styles.contact}>
            {[user?.phone, user?.email].filter(Boolean).join(' · ')}
          </Text>

          {completedVisits > 0 && (
            <View style={styles.heroStat}>
              <Text style={styles.heroStatTxt}>
                {completedVisits} visit{completedVisits === 1 ? '' : 's'} completed
              </Text>
            </View>
          )}
        </LinearGradient>

        {needsName && (
          <TouchableOpacity
            style={styles.nudge}
            onPress={() => router.push('/edit-profile')}
            testID="profile-add-name"
          >
            <Ionicons name="information-circle" size={18} color={Colors.primary} />
            <Text style={styles.nudgeTxt}>
              Add your name so your nurse knows who to ask for at the door.
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.row}
              onPress={item.onPress}
              testID={`profile-${item.title}`}
            >
              <View
                style={[styles.rowIcon, item.highlight && { backgroundColor: Colors.warningBg }]}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.highlight ? Colors.warning : Colors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text
                  style={[styles.rowSub, item.highlight && { color: Colors.warning }]}
                  numberOfLines={1}
                >
                  {item.sub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.row} onPress={signOut} testID="consumer-signout">
            <View style={[styles.rowIcon, { backgroundColor: Colors.errorBg }]}>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1, marginLeft: 12, color: Colors.danger }]}>
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    ...Shadows.floating,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.h3, color: '#fff', marginTop: Spacing.sm },
  contact: { ...Typography.small, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroStat: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  heroStatTxt: { ...Typography.small, color: '#fff', fontWeight: '600' as const },
  nudge: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: 12,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  nudgeTxt: { ...Typography.small, color: Colors.primary, flex: 1, lineHeight: 18 },
  list: { padding: Spacing.lg, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadows.card,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
