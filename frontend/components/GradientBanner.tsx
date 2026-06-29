import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  ctaTitle?: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

export const GradientBanner: React.FC<Props> = ({
  title,
  subtitle,
  ctaTitle,
  onPress,
  icon = 'shield-checkmark-outline',
  testID,
}) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} testID={testID || 'gradient-banner'}>
    <LinearGradient
      colors={Gradients.softBanner as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      {ctaTitle && (
        <View style={styles.cta}>
          <Text style={styles.ctaTxt}>{ctaTitle}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    ...Shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h4, color: Colors.primaryDark },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctaTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
});
