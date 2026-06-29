import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Typography, Gradients } from '../constants/theme';

interface Props {
  label: string;
  value: string;
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'teal' | 'primary' | 'plain';
  testID?: string;
}

export const StatsCard: React.FC<Props> = ({
  label,
  value,
  caption,
  icon = 'stats-chart',
  variant = 'teal',
  testID,
}) => {
  if (variant === 'plain') {
    return (
      <View style={[styles.plain]} testID={testID}>
        <View style={styles.plainIconBox}>
          <Ionicons name={icon} size={18} color={Colors.primary} />
        </View>
        <Text style={styles.plainValue}>{value}</Text>
        <Text style={styles.plainLabel}>{label}</Text>
      </View>
    );
  }

  const colors = variant === 'teal' ? Gradients.teal : Gradients.primary;
  return (
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card]}
      testID={testID}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption && <Text style={styles.caption}>{caption}</Text>}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 130,
    borderRadius: Radius.xl,
    padding: 16,
    justifyContent: 'space-between',
    ...Shadows.floating,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 8 },
  label: { ...Typography.small, color: 'rgba(255,255,255,0.85)', fontWeight: '600' as const, marginTop: 2 },
  caption: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  plain: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadows.card,
  },
  plainIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  plainValue: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const },
  plainLabel: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
