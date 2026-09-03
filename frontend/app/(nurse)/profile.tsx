/**
 * Care professional profile.
 *
 * Stats come from the worker profile — the previous version showed hardcoded
 * "187 visits / 4.9 rating / Verified Nurse · BSc Nursing" to every account,
 * including brand new and unverified ones.
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { humanize } from '../../lib/format';

export default function NurseProfileScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const workerProfile = useStore((s) => s.workerProfile);
  const onboarding = useStore((s) => s.onboarding);
  const loadWorkerProfileAPI = useStore((s) => s.loadWorkerProfileAPI);
  const loadOnboardingAPI = useStore((s) => s.loadOnboardingAPI);
  const logout = useStore((s) => s.logout);

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadWorkerProfileAPI().catch(() => {});
      loadOnboardingAPI().catch(() => {});
    }, [loadWorkerProfileAPI, loadOnboardingAPI]),
  );

  const approved = onboarding?.onboarding_status === 'approved';
  const rating = Number(workerProfile?.rating_average ?? 0);
  const ratingCount = workerProfile?.rating_count ?? 0;
  const isDoctor = workerProfile?.worker_type === 'doctor';

  const items = [
    {
      icon: 'shield-check-outline' as const,
      title: 'Verification',
      sub: approved ? 'Approved' : humanize(onboarding?.onboarding_status ?? 'In progress'),
      onPress: () => router.push('/onboarding-status'),
      highlight: !approved,
    },
    {
      icon: 'cash-multiple' as const,
      title: 'Earnings',
      sub: 'Payouts and history',
      onPress: () => router.push('/earnings'),
    },
    // Doctor-only: teleconsult queue + e-prescription signature. Hidden for
    // every other provider type (nurse/dentist/physio/caregiver/mother-baby).
    ...(isDoctor
      ? [
          {
            icon: 'stethoscope' as const,
            title: 'Teleconsult queue',
            sub: 'Waiting, diet, patient issues, prescription',
            onPress: () => router.push('/(nurse)/teleconsult-queue'),
          },
          {
            icon: 'draw-pen' as const,
            title: 'E-Prescription signature',
            sub: 'Stamped on every prescription you issue',
            onPress: () => router.push('/(nurse)/eprescription-signature'),
          },
        ]
      : []),
    {
      icon: 'clipboard-check-outline' as const,
      title: 'My services',
      sub: 'Care packages you accept',
      onPress: () => router.push('/service-preferences'),
    },
    {
      icon: 'calendar-clock' as const,
      title: 'Availability & area',
      sub: 'Status and travel radius',
      onPress: () => router.push('/availability'),
    },
    {
      icon: 'school-outline' as const,
      title: 'Training',
      sub: 'Modules and assessments',
      onPress: () => router.push('/training'),
    },
    {
      icon: 'certificate-outline' as const,
      title: 'Certificates',
      sub: 'What you’ve earned',
      onPress: () => router.push('/certificates'),
    },
    {
      icon: 'file-document-outline' as const,
      title: 'Documents',
      sub: 'Licence, ID and checks',
      onPress: () => router.push('/documents'),
    },
    {
      icon: 'file-sign' as const,
      title: 'Partner Agreement',
      sub: 'Onboarding & contractor terms',
      onPress: () => router.push('/(nurse)/contract'),
    },
    {
      icon: 'medical-bag' as const,
      title: 'Kit checklist',
      sub: 'Daily preparation',
      onPress: () => router.push('/(nurse)/kit'),
    },
    {
      icon: 'account-edit-outline' as const,
      title: 'Edit profile',
      sub: 'Bio and registration',
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: 'help-circle-outline' as const,
      title: 'Help & support',
      sub: 'Raise a request',
      onPress: () => router.push('/support'),
    },
  ];

  const signOut = () => {
    Alert.alert('Sign out?', 'You’ll need to sign in again to see your visits.', [
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
    <SafeAreaView style={styles.safe} testID="nurse-profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My profile" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.allSettled([loadWorkerProfileAPI(), loadOnboardingAPI()]);
              setRefreshing(false);
            }}
          />
        }
      >
        <LinearGradient
          colors={Gradients.teal as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="medical-bag" size={30} color={Colors.teal} />
          </View>
          <Text style={styles.name}>{user?.name || 'Care professional'}</Text>

          <View style={styles.verifiedRow}>
            <Ionicons
              name={approved ? 'checkmark-circle' : 'time-outline'}
              size={13}
              color="#fff"
            />
            <Text style={styles.verifiedTxt}>
              {approved ? 'Verified' : 'Verification in progress'}
              {workerProfile?.tier ? ` · ${humanize(workerProfile.tier)}` : ''}
            </Text>
          </View>

          <View style={styles.heroStats}>
            <Stat
              value={String(workerProfile?.completed_visits_count ?? 0)}
              label="Visits"
            />
            <Stat
              value={ratingCount > 0 ? rating.toFixed(1) : '—'}
              label={ratingCount > 0 ? `Rating (${ratingCount})` : 'No ratings yet'}
            />
            <Stat
              value={String(workerProfile?.years_of_experience ?? 0)}
              label="Years exp."
            />
          </View>
        </LinearGradient>

        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.row}
              onPress={item.onPress}
              testID={`profile-${item.title}`}
            >
              <View
                style={[
                  styles.rowIcon,
                  item.highlight && { backgroundColor: Colors.warningBg },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={item.highlight ? Colors.warning : Colors.teal}
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

          <TouchableOpacity style={styles.row} onPress={signOut} testID="nurse-signout">
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

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatNum}>{value}</Text>
    <Text style={styles.heroStatLab}>{label}</Text>
  </View>
);

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
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  verifiedTxt: { ...Typography.small, color: 'rgba(255,255,255,0.9)' },
  heroStats: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.lg,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  heroStat: { alignItems: 'center' },
  heroStatNum: { ...Typography.h3, color: '#fff', fontWeight: '800' as const },
  heroStatLab: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
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
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
