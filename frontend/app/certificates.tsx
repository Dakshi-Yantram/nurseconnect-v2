/**
 * Certificates earned by this care professional.
 *
 * Read from `/workers/me/certificates`. Expiry matters: a lapsed certificate
 * can drop a nurse out of the qualification gate for any package that
 * requires it, so status is derived from the real `valid_until` rather than a
 * stored label.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { EmptyState } from '../components/EmptyState';
import { GradientButton } from '../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { workerSelfService, type CertificateOut } from '../services/worker-self.service';
import { formatDay } from '../lib/format';

/** Anything lapsing within 60 days is worth flagging before it does. */
const EXPIRING_SOON_DAYS = 60;

export function certificateStatus(c: CertificateOut): 'active' | 'expiring' | 'expired' {
  if (!c.valid_until) return 'active';
  const days = (new Date(c.valid_until).getTime() - Date.now()) / 86_400_000;
  if (isNaN(days)) return 'active';
  if (days < 0) return 'expired';
  return days <= EXPIRING_SOON_DAYS ? 'expiring' : 'active';
}

export const CERT_TONE = {
  active: { bg: Colors.successBg, fg: Colors.success, label: 'Valid' },
  expiring: { bg: Colors.warningBg, fg: Colors.warning, label: 'Expiring soon' },
  expired: { bg: Colors.errorBg, fg: Colors.danger, label: 'Expired' },
};

export default function Certificates() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setCertificates(await workerSelfService.certificates());
    } catch (e: any) {
      setError(e?.message || 'Could not load your certificates');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} testID="certificates-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Certificates" fallbackHref="/(nurse)/profile" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      ) : certificates.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Certificates you earn through training, and any your reviewer records, appear here."
          icon="ribbon-outline"
          ctaTitle="Browse training"
          onCtaPress={() => router.push('/training')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          {certificates.map((c) => {
            const tone = CERT_TONE[certificateStatus(c)];
            const expired = certificateStatus(c) === 'expired';
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: '/certificates/[id]', params: { id: c.id } })
                }
                testID={`cert-${c.id}`}
              >
                <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                  <FontAwesome5 name="award" size={22} color={tone.fg} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title}>{c.name}</Text>
                  {!!c.issued_by && <Text style={styles.sub}>{c.issued_by}</Text>}
                  {!!c.valid_until && (
                    <Text style={styles.expiry}>
                      {expired ? 'Expired' : 'Valid until'} {formatDay(c.valid_until.slice(0, 10))}
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.badgeTxt, { color: tone.fg }]}>{tone.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  expiry: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, fontWeight: '700' as const },
});
