import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from './Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { ROLE_LABEL } from '../lib/roles';

/**
 * Profile screen shared by the trainer and clinical-lead portals.
 *
 * Staff accounts are created and managed by Operations on the web portal, so
 * nothing here is editable — showing edit affordances that 403 would be worse
 * than saying plainly where to go.
 */
export const StaffProfile: React.FC<{ fallbackHref: string }> = ({ fallbackHref }) => {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const role = useStore((s) => s.role);
  const logout = useStore((s) => s.logout);

  const signOut = () => {
    Alert.alert('Sign out?', 'You’ll need your credentials to sign back in.', [
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
    <SafeAreaView style={styles.safe} edges={['top']} testID="staff-profile">
      <Header title="Profile" showBack={false} fallbackHref={fallbackHref} />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="school" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.name}>{user?.name || 'Staff member'}</Text>
          {!!role && <Text style={styles.role}>{ROLE_LABEL[role]}</Text>}
          {!!user?.email && <Text style={styles.contact}>{user.email}</Text>}
          {!!user?.phone && <Text style={styles.contact}>{user.phone}</Text>}
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.noteTxt}>
            Your account details are managed by the Operations team on the NurseConnect web
            portal. Contact them to change your name, email or role.
          </Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/privacy')}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.rowTxt}>Privacy policy</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={signOut} testID="staff-signout">
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={[styles.rowTxt, { color: Colors.danger }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.h3, color: Colors.textPrimary, marginTop: Spacing.md },
  role: { ...Typography.small, color: Colors.accent, fontWeight: '700' as const, marginTop: 4 },
  contact: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  noteCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  noteTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginTop: Spacing.sm,
    ...Shadows.card,
  },
  rowTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
});
