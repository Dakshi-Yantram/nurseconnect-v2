import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { CERTIFICATES } from '../../mock-data/abha';

export default function CertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = CERTIFICATES.find((x) => x.id === id) || CERTIFICATES[0];
  if (!c) return null;
  return (
    <SafeAreaView style={styles.safe} testID="cert-detail" edges={['top']}>
      <OfflineBanner />
      <Header title="Certificate" fallbackHref="/certificates" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <LinearGradient
          colors={Gradients.accent as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <FontAwesome5 name="award" size={48} color="#fff" />
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.issuer}>Issued by {c.issuedBy}</Text>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View>
              <Text style={styles.lab}>Cert #</Text>
              <Text style={styles.val}>{c.certNumber}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.lab}>Issued</Text>
              <Text style={styles.val}>
                {new Date(c.issuedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          {c.expiryDate && (
            <View style={styles.row}>
              <View>
                <Text style={styles.lab}>Expires</Text>
                <Text style={styles.val}>
                  {new Date(c.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: c.status === 'active' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
                <Text style={styles.badgeTxt}>{c.status}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        <GradientButton
          title="Download as PDF"
          onPress={() => Alert.alert('Downloaded', `${c.title}.pdf saved`)}
          testID="download-pdf"
          style={{ marginTop: 16 }}
          icon={<Ionicons name="download-outline" size={18} color="#fff" />}
        />
        <GradientButton
          title="Share"
          variant="outline"
          onPress={() => Alert.alert('Shared', 'Link sent via WhatsApp')}
          testID="share-cert"
          style={{ marginTop: 8 }}
        />
        {c.status === 'expiring' && (
          <GradientButton
            title="Renew certificate"
            variant="accent"
            onPress={() => Alert.alert('Renewal scheduled', 'Renewal reminder set for next week')}
            testID="renew-cert"
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { padding: 24, borderRadius: Radius.xl, alignItems: 'center', ...Shadows.floating },
  title: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 16, textAlign: 'center' },
  issuer: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 4 },
  lab: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  val: { ...Typography.bodyBold, color: '#fff', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, color: '#fff', fontWeight: '700' as const, textTransform: 'capitalize' },
});
