import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';

interface Props {
  title: string;
  hint: string;
  /** Called with the raw base64 payload once the nurse takes the photo. */
  onCaptured: (base64: string, uri: string) => void;
  /** Shown once a photo has been captured (e.g. after a successful submit). */
  submitted?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * Mandatory live-camera capture (never gallery — Steps 5 & 6 require an
 * in-the-moment photo, not a pre-existing one) that hands back base64 so the
 * caller can POST it straight to the backend, which uploads to Cloudinary
 * and overlays timestamp/GPS/Order_ID metadata server-side.
 */
export const PhotoCapture: React.FC<Props> = ({ title, hint, onCaptured, submitted, disabled, testID }) => {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openAppSettings = () => {
    Linking.openSettings().catch(() =>
      Alert.alert('Could not open Settings', 'Please open Settings manually to update permissions.'),
    );
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const requested = await ImagePicker.requestCameraPermissionsAsync();
      if (requested.granted) return true;
    }
    Alert.alert(
      'Camera access needed',
      'NurseConnect needs camera access to capture this required photo. Please enable it in Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openAppSettings },
      ],
    );
    return false;
  };

  const capture = async () => {
    if (disabled || busy) return;
    const ok = await ensureCameraPermission();
    if (!ok) return;
    setBusy(true);
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: Platform.OS !== 'web',
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!asset.base64) {
        Alert.alert('Could not read photo', 'Please try taking the photo again.');
        return;
      }
      setPreviewUri(asset.uri);
      onCaptured(asset.base64, asset.uri);
    } catch (e: any) {
      Alert.alert('Could not open camera', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, submitted && styles.cardDone]}
      onPress={capture}
      activeOpacity={0.8}
      disabled={disabled || busy}
      testID={testID}
    >
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          {busy ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Ionicons name="camera" size={26} color={submitted ? Colors.success : Colors.primary} />
          )}
        </View>
      )}
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {submitted && <Ionicons name="checkmark-circle" size={22} color={Colors.success} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    ...Shadows.card,
  },
  cardDone: { borderStyle: 'solid', borderColor: Colors.success + '55' },
  thumb: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.bodyBold, fontWeight: '600' as const, color: Colors.textPrimary },
  hint: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
