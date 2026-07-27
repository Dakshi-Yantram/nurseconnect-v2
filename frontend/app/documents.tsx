/**
 * Verification documents.
 *
 * The required set depends on worker type (nurse vs caregiver) and comes from
 * the onboarding snapshot — nothing is hardcoded here, because the list a
 * caregiver needs is not the list a nurse needs.
 *
 * Uploads go through `/workers/me/documents/upload` as base64, which is what
 * that endpoint accepts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { GradientButton } from '../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { workerSelfService, type DocumentOut } from '../services/worker-self.service';
import { formatDay, humanize } from '../lib/format';

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string; icon: any }> = {
  verified: {
    bg: Colors.successBg,
    fg: Colors.success,
    label: 'Verified',
    icon: 'checkmark-circle',
  },
  pending: { bg: Colors.warningBg, fg: Colors.warning, label: 'Awaiting review', icon: 'time' },
  rejected: { bg: Colors.errorBg, fg: Colors.danger, label: 'Rejected', icon: 'close-circle' },
};

export default function Documents() {
  const router = useRouter();
  const onboarding = useStore((s) => s.onboarding);
  const loadOnboardingAPI = useStore((s) => s.loadOnboardingAPI);

  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [docs] = await Promise.allSettled([
      workerSelfService.documents(),
      loadOnboardingAPI(),
    ]);
    if (docs.status === 'fulfilled') setDocuments(docs.value);
    else setError(docs.reason?.message || 'Could not load your documents');
    setLoading(false);
  }, [loadOnboardingAPI]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Merge the required-document catalogue with what's actually been uploaded,
   * so a missing document is a visible row rather than an absent one.
   */
  const rows = useMemo(() => {
    const uploaded = new Map(documents.map((d) => [d.document_type, d]));
    const required = (onboarding?.documents ?? []).map((entry) => ({
      type: entry.document_type,
      label: entry.label || humanize(entry.document_type),
      required: entry.required !== false,
      doc: uploaded.get(entry.document_type) ?? null,
    }));
    // Anything uploaded that isn't in the catalogue still deserves a row.
    const extras = documents
      .filter((d) => !required.some((r) => r.type === d.document_type))
      .map((d) => ({
        type: d.document_type,
        label: humanize(d.document_type),
        required: false,
        doc: d,
      }));
    return [...required, ...extras];
  }, [documents, onboarding]);

  const upload = async (documentType: string, label: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access so you can attach a picture or scan of your document.',
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]?.base64) return;

    setUploading(documentType);
    try {
      await workerSelfService.uploadDocument({
        document_type: documentType,
        data_base64: picked.assets[0].base64,
      });
      await load();
      Alert.alert('Uploaded', `${label} has been sent for verification.`);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const missingCount = rows.filter((r) => r.required && !r.doc).length;
  const rejectedCount = rows.filter((r) => r.doc?.verification_status === 'rejected').length;

  return (
    <SafeAreaView style={styles.safe} testID="documents-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My documents" fallbackHref="/(nurse)/profile" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
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
          {!!error && (
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          )}

          {(missingCount > 0 || rejectedCount > 0) && (
            <View style={styles.summaryCard}>
              <Ionicons name="alert-circle" size={20} color={Colors.warning} />
              <Text style={styles.summaryTxt}>
                {missingCount > 0 &&
                  `${missingCount} required document${missingCount === 1 ? '' : 's'} still needed. `}
                {rejectedCount > 0 &&
                  `${rejectedCount} need${rejectedCount === 1 ? 's' : ''} re-uploading. `}
                You can’t accept visits until verification is complete.
              </Text>
            </View>
          )}

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              No documents are required for your account type right now.
            </Text>
          ) : (
            rows.map((row) => {
              const status = row.doc?.verification_status ?? null;
              const tone = status ? (STATUS_TONE[status] ?? STATUS_TONE.pending) : null;
              const busy = uploading === row.type;

              return (
                <View key={row.type} style={styles.row} testID={`doc-${row.type}`}>
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: tone?.bg ?? Colors.surfaceAlt },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={20}
                      color={tone?.fg ?? Colors.textTertiary}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{row.label}</Text>
                    {row.doc ? (
                      <>
                        <Text style={[styles.statusTxt, { color: tone?.fg }]}>
                          {tone?.label ?? humanize(status ?? '')}
                        </Text>
                        {!!row.doc.valid_until && (
                          <Text style={styles.expiry}>
                            Valid until {formatDay(row.doc.valid_until.slice(0, 10))}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.pendingTxt}>
                        {row.required ? 'Required — not uploaded' : 'Optional'}
                      </Text>
                    )}
                  </View>

                  {(!row.doc || status === 'rejected') && (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => upload(row.type, row.label)}
                      disabled={busy}
                      testID={`upload-${row.type}`}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={15} color={Colors.primary} />
                          <Text style={styles.uploadTxt}>
                            {status === 'rejected' ? 'Replace' : 'Upload'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          <GradientButton
            title="View verification status"
            variant="outline"
            onPress={() => router.push('/onboarding-status')}
            style={{ marginTop: Spacing.md }}
            testID="view-onboarding"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: Spacing.md,
  },
  errorTxt: { ...Typography.small, color: Colors.danger, flex: 1 },
  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: Spacing.md,
  },
  summaryTxt: { ...Typography.small, color: Colors.warning, flex: 1, lineHeight: 18 },
  emptyTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    ...Shadows.card,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  statusTxt: { ...Typography.small, marginTop: 2, fontWeight: '600' as const },
  pendingTxt: { ...Typography.small, color: Colors.textTertiary, marginTop: 2 },
  expiry: { ...Typography.caption, color: Colors.textTertiary, marginTop: 3 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    minWidth: 84,
    justifyContent: 'center',
  },
  uploadTxt: { ...Typography.caption, color: Colors.primary, fontWeight: '700' as const },
});
