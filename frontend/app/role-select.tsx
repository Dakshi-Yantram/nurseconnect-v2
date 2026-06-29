import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

export default function RoleSelect() {
  const router = useRouter();
  const setRole = useStore((s) => s.setRole);

  const choose = (role: 'family' | 'nurse') => {
    setRole(role);
    router.push('/login');
  };

  return (
    <SafeAreaView style={styles.safe} testID="role-select">
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
              Book a nurse, track visits, manage payments & ABHA records
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
            <Text style={styles.cardTitle}>I’m a Nurse</Text>
            <Text style={styles.cardDesc}>
              Accept assignments, document care, track earnings & shifts
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />
      <Text style={styles.legal}>
        By continuing you agree to our{' '}
        <Text style={{ color: Colors.primary }}>Terms</Text> and{' '}
        <Text style={{ color: Colors.primary }}>Privacy Policy</Text>
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.lg },
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
  legal: { ...Typography.small, color: Colors.textTertiary, textAlign: 'center', marginBottom: 8 },
});
