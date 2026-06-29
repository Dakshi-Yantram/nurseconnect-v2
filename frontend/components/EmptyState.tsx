import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { GradientButton } from './GradientButton';

interface Props {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  ctaTitle?: string;
  onCtaPress?: () => void;
}

export const EmptyState: React.FC<Props> = ({
  title,
  description,
  icon = 'documents-outline',
  ctaTitle,
  onCtaPress,
}) => (
  <View style={styles.wrap} testID="empty-state">
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={42} color={Colors.primary} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {description && <Text style={styles.desc}>{description}</Text>}
    {ctaTitle && (
      <GradientButton
        title={ctaTitle}
        onPress={onCtaPress}
        fullWidth={false}
        style={{ marginTop: Spacing.lg, paddingHorizontal: 32 }}
        testID="empty-state-cta"
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: Spacing.xl },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  desc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: Spacing.md,
  },
});
