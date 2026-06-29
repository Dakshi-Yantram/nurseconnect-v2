import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function NurseProfileScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const items = [
    { icon: 'cash-multiple', title: 'Earnings', sub: 'Payments & history', onPress: () => router.push('/earnings') },
    { icon: 'clipboard-check-outline', title: 'Services I Accept', sub: 'Package & service preferences', onPress: () => router.push('/service-preferences') },
    { icon: 'school-outline', title: 'Training & Certifications', sub: '12 courses · 8 certificates', onPress: () => router.push('/training') },
    { icon: 'calendar-clock', title: 'Availability', sub: 'Set your schedule', onPress: () => router.push('/availability') },
    { icon: 'medical-bag', title: 'Kit checklist', sub: 'Daily preparation', onPress: () => router.push('/(nurse)/kit') },
    { icon: 'shield-check-outline', title: 'Documents', sub: 'License, ID, certificates', onPress: () => router.push('/documents') },
    { icon: 'account-edit-outline', title: 'Edit profile', sub: 'Personal info', onPress: () => router.push('/edit-profile') },
    { icon: 'help-circle-outline', title: 'Help & support', sub: '24x7 partner care', onPress: () => router.push('/support') },
  ];

  return (
    <SafeAreaView style={styles.safe} testID="nurse-profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My Profile" showBack={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <LinearGradient
          colors={Gradients.teal as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Image
            source={{
              uri:
                user?.avatar ||
                'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80',
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.name || 'Priya Sharma'}</Text>
          <View style={styles.verifiedRow}>
            <FontAwesome5 name="check-circle" size={12} color="#fff" />
            <Text style={styles.verifiedTxt}>Verified Nurse · BSc Nursing</Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>187</Text>
              <Text style={styles.heroStatLab}>Visits</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>4.9</Text>
              <Text style={styles.heroStatLab}>Rating ★</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>8y</Text>
              <Text style={styles.heroStatLab}>Experience</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.list}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.title}
              style={styles.row}
              onPress={it.onPress}
              testID={`nurse-profile-${it.title.toLowerCase().replace(/[\s&]+/g, '-')}`}
            >
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={it.icon as any} size={20} color={Colors.teal} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                <Text style={styles.rowSub}>{it.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace('/role-select');
          }}
          testID="nurse-logout"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: {
    margin: Spacing.lg,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
    ...Shadows.floating,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  name: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 12 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verifiedTxt: { ...Typography.small, color: 'rgba(255,255,255,0.85)' },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroStat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 12, borderRadius: Radius.md },
  heroStatNum: { ...Typography.h3, color: '#fff', fontWeight: '800' as const },
  heroStatLab: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  list: { paddingHorizontal: Spacing.lg, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, ...Shadows.card },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E0F7FA', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.lg,
    padding: 14,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.lg,
    gap: 8,
  },
  logoutTxt: { ...Typography.bodyBold, color: Colors.error },
});
