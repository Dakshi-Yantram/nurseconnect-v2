import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { CareType } from '../types';

interface Props {
  care: CareType;
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
}

export const CarePackageCard: React.FC<Props> = ({ care, onPress, selected, testID }) => {
  const Icon: any =
    care.iconLib === 'FontAwesome5'
      ? FontAwesome5
      : care.iconLib === 'Ionicons'
      ? Ionicons
      : MaterialCommunityIcons;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, selected && { borderColor: Colors.primary, borderWidth: 2 }]}
      testID={testID || `care-${care.id}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: care.color + '15' }]}>
        <Icon name={care.icon} size={22} color={care.color} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {care.title}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>
        {care.description}
      </Text>
      <View style={styles.footerRow}>
        <Text style={styles.rate}>₹{care.baseRate}/hr</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    minHeight: 150,
    margin: 6,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { ...Typography.h4, color: Colors.textPrimary },
  desc: { ...Typography.small, color: Colors.textSecondary, marginTop: 4, flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rate: { ...Typography.small, color: Colors.primary, fontWeight: '800' as const },
});
