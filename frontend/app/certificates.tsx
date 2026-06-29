import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { CERTIFICATES } from '../mock-data/abha';

export default function Certificates() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} testID="certificates-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Certificates" fallbackHref="/training" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        {CERTIFICATES.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/certificates/[id]', params: { id: c.id } })}
            testID={`cert-${c.id}`}
          >
            <View style={[styles.icon, { backgroundColor: c.status === 'expiring' ? '#FFF7ED' : '#FEF3C7' }]}>
              <FontAwesome5 name="award" size={24} color={c.status === 'expiring' ? Colors.warning : Colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.sub}>{c.issuedBy}</Text>
              <Text style={styles.id}>#{c.certNumber}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: c.status === 'active' ? Colors.successBg : c.status === 'expiring' ? Colors.warningBg : Colors.errorBg }]}>
              <Text style={[styles.badgeTxt, { color: c.status === 'active' ? Colors.success : c.status === 'expiring' ? Colors.warning : Colors.error }]}>
                {c.status}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 10, ...Shadows.card },
  icon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  id: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, fontWeight: '700' as const, textTransform: 'capitalize' },
});
