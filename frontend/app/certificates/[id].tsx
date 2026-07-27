/**
 * Certificate detail.
 *
 * Looked up from the worker's own certificate list — the backend has no
 * per-certificate endpoint. Only offers to open the hosted file when one
 * actually exists, rather than showing a download button that does nothing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { workerSelfService, type CertificateOut } from '../../services/worker-self.service';
import { certificateStatus, CERT_TONE } from '../certificates';
import { formatDay } from '../../lib/format';

export default function CertificateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [certificate, setCertificate] = useState<CertificateOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await workerSelfService.certificates();
      setCertificate(rows.find((c) => c.id === id) ?? null);
      if (!rows.some((c) => c.id === id)) setError('This certificate could not be found.');
    } catch (e: any) {
      setError(e?.message || 'Could not load this certificate');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Certificate" fallbackHref="/certificates" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!certificate) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Certificate" fallbackHref="/certificates" />
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = certificateStatus(certificate);
  const tone = CERT_TONE[status];

  return (
    <SafeAreaView style={styles.safe} testID="certificate-detail" edges={['top']}>
      <OfflineBanner />
      <Header title="Certificate" fallbackHref="/certificates" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        <View style={styles.card}>
          <View style={[styles.hero, { backgroundColor: tone.bg }]}>
            <FontAwesome5 name="award" size={40} color={tone.fg} />
          </View>
          <Text style={styles.title}>{certificate.name}</Text>
          {!!certificate.issued_by && <Text style={styles.sub}>{certificate.issued_by}</Text>}
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeTxt, { color: tone.fg }]}>{tone.label}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.secTitle}>Details</Text>
          {!!certificate.issued_on && (
            <Row label="Issued" value={formatDay(certificate.issued_on.slice(0, 10))} />
          )}
          {!!certificate.valid_until && (
            <Row label="Valid until" value={formatDay(certificate.valid_until.slice(0, 10))} />
          )}
          {!certificate.valid_until && <Row label="Validity" value="No expiry" />}
        </View>

        {status === 'expired' && (
          <View style={styles.warnCard}>
            <Ionicons name="warning" size={18} color={Colors.danger} />
            <Text style={styles.warnTxt}>
              This certificate has lapsed. Any care package that requires it is closed to you
              until it’s renewed and re-verified.
            </Text>
          </View>
        )}
        {status === 'expiring' && (
          <View style={[styles.warnCard, { backgroundColor: Colors.warningBg }]}>
            <Ionicons name="time" size={18} color={Colors.warning} />
            <Text style={[styles.warnTxt, { color: Colors.warning }]}>
              Renew this before it expires so you don’t lose access to the packages that need it.
            </Text>
          </View>
        )}

        {certificate.cloudinary_url ? (
          <GradientButton
            title="Open certificate"
            onPress={() =>
              Linking.openURL(certificate.cloudinary_url!).catch(() =>
                Alert.alert('Could not open', 'The certificate link appears to be invalid.'),
              )
            }
            style={{ marginTop: Spacing.md }}
            icon={<Ionicons name="open-outline" size={18} color="#fff" />}
            testID="cert-open"
          />
        ) : (
          <View style={styles.noFile}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.noFileTxt}>
              No file is attached to this certificate — only the details above.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.kv}>
    <Text style={styles.k}>{label}</Text>
    <Text style={styles.v}>{value}</Text>
  </View>
);

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
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  hero: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h3, color: Colors.textPrimary, marginTop: 14, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  badgeTxt: { ...Typography.small, fontWeight: '700' as const },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  secTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  k: { ...Typography.body, color: Colors.textSecondary },
  v: { ...Typography.bodyBold, color: Colors.textPrimary },
  warnCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  warnTxt: { ...Typography.small, color: Colors.danger, flex: 1, lineHeight: 18 },
  noFile: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  noFileTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});
