import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { EmptyState } from './EmptyState';
import type { LoadState } from '../store';

interface Props {
  state: LoadState;
  /** True when the collection came back with nothing. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyCtaTitle?: string;
  onEmptyCtaPress?: () => void;
  onRetry?: () => void;
  children: React.ReactNode;
}

/**
 * Renders exactly one of: skeleton, error-with-retry, empty state, or content.
 *
 * The distinction that matters is between "loaded and genuinely empty" and
 * "failed to load". Collapsing those two into a single empty state is what
 * makes a broken API look like a normal empty account.
 */
export const AsyncBoundary: React.FC<Props> = ({
  state,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyCtaTitle,
  onEmptyCtaPress,
  onRetry,
  children,
}) => {
  if (state.loading && !state.loaded) {
    return (
      <View style={styles.centered} testID="async-loading">
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingTxt}>Loading…</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.errorCard} testID="async-error">
        <Ionicons name="cloud-offline-outline" size={28} color={Colors.error} />
        <Text style={styles.errorTitle}>Couldn’t load this</Text>
        <Text style={styles.errorMsg}>{state.error}</Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} testID="async-retry">
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryTxt}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        ctaTitle={emptyCtaTitle}
        onCtaPress={onEmptyCtaPress}
      />
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centered: { padding: Spacing.xl, alignItems: 'center', gap: 10 },
  loadingTxt: { ...Typography.small, color: Colors.textSecondary },
  errorCard: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    margin: Spacing.md,
  },
  errorTitle: { ...Typography.bodyBold, color: Colors.danger },
  errorMsg: { ...Typography.small, color: Colors.danger, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  retryTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
