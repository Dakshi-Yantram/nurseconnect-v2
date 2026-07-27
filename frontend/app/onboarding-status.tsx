/**
 * Verification status for a care professional.
 *
 * Until onboarding is approved a nurse cannot accept any visit, so this
 * screen spells out exactly what is outstanding — the backend returns
 * `missing_profile_fields`, `missing_documents` and `rejected_documents`,
 * and refuses submission until all three are clear.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { workerSelfService } from '../services/worker-self.service';
import { humanize } from '../lib/format';

const STATUS_COPY: Record<string, { title: string; body: string; tone: string; icon: any }> = {
  documents_pending: {
    title: 'Documents needed',
    body: 'Upload the documents below, then submit your profile for review.',
    tone: Colors.warning,
    icon: 'cloud-upload-outline',
  },
  pending_review: {
    title: 'Under review',
    body: 'A reviewer is checking your documents. We’ll notify you as soon as there’s a decision — usually within two working days.',
    tone: Colors.primary,
    icon: 'hourglass-outline',
  },
  approved: {
    title: 'Verified',
    body: 'You’re approved and can accept visits.',
    tone: Colors.success,
    icon: 'checkmark-circle-outline',
  },
  rejected: {
    title: 'Changes needed',
    body: 'A reviewer found a problem with your submission. Fix the points below and resubmit.',
    tone: Colors.danger,
    icon: 'alert-circle-outline',
  },
};

/** Turn a backend field key into something a person recognises. */
const FIELD_LABELS: Record<string, string> = {
  full_name: 'Your full name',
  date_of_birth: 'Date of birth',
  registration_no: 'Nursing registration number',
  registration_authority: 'Registration authority (council)',
  registration_valid_until: 'Registration expiry date',
  registration_valid_until_not_expired: 'Your registration has expired — renew it',
  base_city: 'Base city',
};

export default function OnboardingStatus() {
  const router = useRouter();
  const onboarding = useStore((s) => s.onboarding);
  const loadOnboardingAPI = useStore((s) => s.loadOnboardingAPI);

  const [loading, setLoading] = useState(!onboarding);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      await loadOnboardingAPI();
    } catch (e: any) {
      setError(e?.message || 'Could not load your verification status');
    } finally {
      setLoading(false);
    }
  }, [loadOnboardingAPI]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      await workerSelfService.submitOnboarding();
      await load();
      Alert.alert(
        'Submitted',
        'Your profile is now with a reviewer. We’ll let you know as soon as it’s approved.',
      );
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert(
        'Not ready yet',
        detail?.message || e?.message || 'Some details are still outstanding.',
      );
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Verification" fallbackHref="/(nurse)/profile" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!onboarding) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Verification" fallbackHref="/(nurse)/profile" />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error || 'Could not load your status.'}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const copy = STATUS_COPY[onboarding.onboarding_status] ?? {
    title: humanize(onboarding.onboarding_status),
    body: 'Your verification is in progress.',
    tone: Colors.textSecondary,
    icon: 'information-circle-outline',
  };
  const approved = onboarding.onboarding_status === 'approved';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="onboarding-status-screen">
      <OfflineBanner />
      <Header title="Verification" fallbackHref="/(nurse)/profile" />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />}
      >
        <View style={[styles.statusCard, { borderColor: copy.tone }]}>
          <Ionicons name={copy.icon} size={32} color={copy.tone} />
          <Text style={[styles.statusTitle, { color: copy.tone }]}>{copy.title}</Text>
          <Text style={styles.statusBody}>{copy.body}</Text>
          {!!onboarding.rejection_reason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Reviewer’s note</Text>
              <Text style={styles.reasonTxt}>{onboarding.rejection_reason}</Text>
            </View>
          )}
        </View>

        {!approved && (
          <>
            {onboarding.missing_profile_fields.length > 0 && (
              <Section
                title="Profile details still needed"
                icon="person-outline"
                items={onboarding.missing_profile_fields.map(
                  (f) => FIELD_LABELS[f] ?? humanize(f),
                )}
                actionLabel="Update profile"
                onAction={() => router.push('/edit-profile')}
              />
            )}

            {onboarding.missing_documents.length > 0 && (
              <Section
                title="Documents still needed"
                icon="document-attach-outline"
                items={onboarding.missing_documents.map(humanize)}
                actionLabel="Upload documents"
                onAction={() => router.push('/documents')}
              />
            )}

            {onboarding.rejected_documents.length > 0 && (
              <Section
                title="Documents to re-upload"
                icon="close-circle-outline"
                tone={Colors.danger}
                items={onboarding.rejected_documents.map(humanize)}
                actionLabel="Re-upload"
                onAction={() => router.push('/documents')}
              />
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <Row label="Role" value={humanize(onboarding.worker_type)} />
          <Row label="Background check" value={humanize(onboarding.background_check_status)} />
          {!!onboarding.submitted_at && (
            <Row label="Submitted" value={onboarding.submitted_at.slice(0, 10)} />
          )}
          {!!onboarding.reviewed_at && (
            <Row label="Reviewed" value={onboarding.reviewed_at.slice(0, 10)} />
          )}
        </View>

        {!approved && onboarding.onboarding_status !== 'pending_review' && (
          <GradientButton
            title={
              onboarding.can_submit_for_review
                ? 'Submit for review'
                : 'Complete the items above first'
            }
            onPress={submit}
            disabled={!onboarding.can_submit_for_review}
            loading={submitting}
            style={{ marginTop: Spacing.md }}
            testID="submit-onboarding"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  actionLabel: string;
  onAction: () => void;
  tone?: string;
}> = ({ title, icon, items, actionLabel, onAction, tone = Colors.warning }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={18} color={tone} />
      <Text style={[styles.sectionTitle, { color: tone }]}>{title}</Text>
    </View>
    {items.map((it) => (
      <View key={it} style={styles.itemRow}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text style={styles.itemTxt}>{it}</Text>
      </View>
    ))}
    <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
      <Text style={styles.actionTxt}>{actionLabel}</Text>
      <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
    </TouchableOpacity>
  </View>
);

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
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderLeftWidth: 4,
    padding: Spacing.card,
    alignItems: 'flex-start',
    ...Shadows.card,
  },
  statusTitle: { ...Typography.h3, marginTop: Spacing.sm },
  statusBody: { ...Typography.body, color: Colors.textSecondary, marginTop: 6, lineHeight: 21 },
  reasonBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
    alignSelf: 'stretch',
  },
  reasonLabel: { ...Typography.caption, color: Colors.danger, fontWeight: '700' as const },
  reasonTxt: { ...Typography.small, color: Colors.danger, marginTop: 3, lineHeight: 18 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { ...Typography.bodyBold },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  itemTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  actionTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const, flex: 1 },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  k: { ...Typography.body, color: Colors.textSecondary },
  v: { ...Typography.bodyBold, color: Colors.textPrimary },
});
