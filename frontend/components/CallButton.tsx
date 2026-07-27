import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { callManager } from '../lib/call-manager';
import { callingSupported, callingUnavailableReason } from '../lib/native-modules';

interface Props {
  bookingId: string;
  /** Who we're calling, shown in the native call UI and our overlay. */
  peerName: string;
  /** False until a nurse is assigned — the backend 409s before then. */
  enabled?: boolean;
  variant?: 'icon' | 'row';
  testID?: string;
}

/**
 * Places an in-app voice call to the other party on a booking.
 *
 * On a build without the native calling modules (notably Expo Go) this
 * explains why rather than silently doing nothing.
 */
export const CallButton: React.FC<Props> = ({
  bookingId,
  peerName,
  enabled = true,
  variant = 'icon',
  testID,
}) => {
  const press = () => {
    if (!enabled) {
      Alert.alert(
        'No nurse assigned yet',
        'You’ll be able to call once a nurse accepts this visit.',
      );
      return;
    }
    const reason = callingUnavailableReason();
    if (reason) {
      Alert.alert('Calling unavailable', reason);
      return;
    }
    callManager.startCall(bookingId, peerName);
  };

  const dimmed = !enabled || !callingSupported();

  if (variant === 'row') {
    return (
      <TouchableOpacity
        style={[styles.row, dimmed && styles.dimmed]}
        onPress={press}
        testID={testID || 'call-button'}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="call" size={18} color={Colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Call {peerName || 'them'}</Text>
          <Text style={styles.rowSub}>Free in-app voice call</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.iconBtn, dimmed && styles.dimmed]}
      onPress={press}
      testID={testID || 'call-button'}
    >
      <Ionicons name="call" size={18} color={Colors.success} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  rowSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  dimmed: { opacity: 0.45 },
});
