import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import type { AppRole } from '../lib/roles';

/**
 * Entry point. Family members and care professionals self-register, so they
 * pick a role here. Trainers and clinical training leads have their accounts
 * created for them by Operations on the web portal, so they go straight to a
 * staff sign-in rather than choosing anything.
 */
export default function RoleSelect() {
  const router = useRouter();
  const setRole = useStore((s) => s.setRole);

  const choose = (role: AppRole) => {
    setRole(role);
    router.push({ pathname: '/login', params: { role } });
  };

  return (
    <SafeAreaView style={styles.safe} testID="role-select">
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, flexGrow: 1 }}>
        <View style={styles.header}>
          <Logo size={56} />
          <Text style={styles.brand}>NurseConnect</Text>
        </View>

        <Text style={styles.title}>How would you like to use NurseConnect?</Text>
        <Text style={styles.sub}>Choose your role to continue</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => choose('family')}
          style={styles.cardWrap}
          testID="role-family"
        >
          <LinearGradient
            colors={Gradients.primary as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.iconBox}>
              <Ionicons name="people" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.cardTitle}>I’m a Family Member</Text>
              <Text style={styles.cardDesc}>
                Book care, track visits, manage payments & health records
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => choose('nurse')}
          style={styles.cardWrap}
          testID="role-nurse"
        >
          <LinearGradient
            colors={Gradients.teal as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name="medical-bag" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.cardTitle}>I’m a Care Professional</Text>
              <Text style={styles.cardDesc}>
                Accept visits, document care, track earnings & training
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ flex: 1, minHeight: Spacing.lg }} />

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/login', params: { role: 'staff' } })}
          style={styles.staffRow}
          testID="role-staff"
        >
          <Ionicons name="school-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.staffTxt}>
            Clinical trainer or training lead?{' '}
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>Staff sign in</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our <Text style={{ color: Colors.primary }}>Terms</Text> and{' '}
          <Text style={{ color: Colors.primary }}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  brand: { ...Typography.h3, marginLeft: 12, color: Colors.textPrimary },
  title: { ...Typography.h2, color: Colors.textPrimary, marginTop: 32 },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 8, marginBottom: 24 },
  cardWrap: { marginBottom: Spacing.md },
  card: {
    borderRadius: Radius.xl,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.floating,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...Typography.h4, color: '#fff', fontWeight: '700' as const },
  cardDesc: { ...Typography.small, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
  },
  staffTxt: { ...Typography.small, color: Colors.textSecondary },
  legal: {
    ...Typography.small,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 8,
  },
});
