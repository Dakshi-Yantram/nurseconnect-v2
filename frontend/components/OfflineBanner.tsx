import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Colors, Spacing, Typography } from '../constants/theme';

export const OfflineBanner: React.FC = () => {
  const isOffline = useStore((s) => s.isOffline);
  const pendingSync = useStore((s) => s.pendingSyncCount);
  if (!isOffline && pendingSync === 0) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: isOffline ? Colors.accent : Colors.info },
      ]}
      testID="offline-banner"
    >
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : 'sync-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isOffline
          ? 'You are offline – changes will sync automatically'
          : `Syncing ${pendingSync} pending updates…`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  text: { ...Typography.small, color: '#fff', fontWeight: '600' as const },
});
