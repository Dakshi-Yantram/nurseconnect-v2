/**
 * Doctor e-signature — the PNG stamped bottom-left on every e-prescription
 * PDF this doctor issues. Doctor-only (WorkerType.doctor); every e-Rx
 * `create` call is rejected by the backend until this exists.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { eprescriptionsService, SignatureStatus } from '../../services/eprescriptions.service';

export default function EPrescriptionSignatureScreen() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<SignatureStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eprescriptionsService.getSignature();
      setStatus(data);
    } catch (e: any) {
      Alert.alert('Could not load signature', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload your signature.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const dataUri = `data:${asset.mimeType ?? 'image/png'};base64,${asset.base64}`;
      await eprescriptionsService.uploadSignature(dataUri);
      await load();
      Alert.alert('Saved', 'Your signature will now be stamped on every e-prescription you issue.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="eprescription-signature-screen" edges={['top']}>
      <Header title="E-Prescription Signature" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        <Text style={styles.intro}>
          Upload a clear photo or scan of your signature on a plain background. It's stamped bottom-left on every
          e-prescription PDF you issue, next to a verification QR code.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <View style={styles.card}>
            {status?.has_signature && status.signature_url ? (
              <>
                <Image source={{ uri: status.signature_url }} style={styles.preview} resizeMode="contain" />
                <Text style={styles.metaText}>
                  Uploaded{' '}
                  {status.uploaded_at
                    ? new Date(status.uploaded_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : ''}
                </Text>
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="draw-pen" size={32} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No signature on file yet</Text>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={pickAndUpload} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {status?.has_signature ? 'Replace signature' : 'Upload signature'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: { ...Typography.body, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  preview: { width: '100%', height: 120, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, marginBottom: Spacing.sm },
  metaText: { fontSize: 12, color: Colors.textTertiary, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  emptyText: { marginTop: Spacing.sm, color: Colors.textTertiary, fontSize: 13 },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 14.5 },
});
