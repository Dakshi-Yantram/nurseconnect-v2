import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const isOffline = useStore((s) => s.isOffline);
  const setOffline = useStore((s) => s.setOffline);
  const logout = useStore((s) => s.logout);

  const items = [
    {
      icon: 'people-outline',
      title: 'Family members',
      sub: 'Manage who you care for',
      onPress: () => router.push('/family-members'),
    },
    {
      icon: 'document-text-outline',
      title: 'ABHA records',
      sub: 'Linked health records',
      onPress: () => router.push('/abha'),
    },
    {
      icon: 'card-outline',
      title: 'Payment settings',
      sub: 'Methods & invoices',
      onPress: () => router.push('/(family)/payments'),
    },
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      sub: 'Preferences & history',
      onPress: () => router.push('/notifications'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & support',
      sub: '24x7 customer care',
      onPress: () => router.push('/support'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy',
      sub: 'Data sharing controls',
      onPress: () => router.push('/privacy'),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Profile" showBack={false} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero */}
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Image
            source={{
              uri:
                user?.avatar ||
                'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80',
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.name || 'Aarav Kumar'}</Text>
          <Text style={styles.phone}>+91 {user?.phone || '9876543210'}</Text>
          <View style={styles.abha}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.abhaTxt}>ABHA: {user?.abhaId || '14-1234-5678-9012'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} testID="edit-profile" onPress={() => router.push('/edit-profile')}>
            <Text style={styles.editTxt}>Edit Profile</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* List */}
        <View style={styles.list}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.title}
              style={styles.row}
              onPress={it.onPress}
              testID={`profile-${it.title.toLowerCase().replace(/[\s&]+/g, '-')}`}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={it.icon as any} size={20} color={Colors.primary} />
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
          style={[styles.row, { margin: Spacing.lg }]}
          onPress={() => setOffline(!isOffline)}
          testID="toggle-offline"
        >
          <View style={[styles.rowIcon, { backgroundColor: Colors.warningBg }]}>
            <Ionicons name="cloud-offline-outline" size={20} color={Colors.warning} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.rowTitle}>Simulate offline mode</Text>
            <Text style={styles.rowSub}>
              {isOffline ? 'Currently offline – tap to go online' : 'Tap to test offline experience'}
            </Text>
          </View>
          <View
            style={[
              styles.toggle,
              { backgroundColor: isOffline ? Colors.warning : Colors.border },
            ]}
          >
            <View style={[styles.toggleKnob, isOffline && { transform: [{ translateX: 18 }] }]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace('/role-select');
          }}
          testID="logout-btn"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>NurseConnect v1.0.0 · Powered by Yantram</Text>
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
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  name: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 12 },
  phone: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  abha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 8,
    gap: 4,
  },
  abhaTxt: { ...Typography.caption, color: '#fff' },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    marginTop: 16,
  },
  editTxt: { ...Typography.bodyBold, color: '#fff' },
  list: { marginHorizontal: Spacing.lg, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadows.card,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
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
  version: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginBottom: 24 },
});
