import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { Nurse } from '../types';

interface Props {
  nurse: Nurse;
  onPress?: () => void;
  testID?: string;
}

export const NurseCard: React.FC<Props> = ({ nurse, onPress, testID }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID || `nurse-card-${nurse.id}`}
    >
      <Image source={{ uri: nurse.avatar }} style={styles.avatar} />
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {nurse.name}
          </Text>
          {nurse.verified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={16}
              color={Colors.primary}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
        <Text style={styles.spec} numberOfLines={1}>
          {nurse.specializations.slice(0, 2).join(' • ')}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="star" size={11} color={Colors.accent} solid />
            <Text style={styles.metaText}>
              {nurse.rating} ({nurse.reviews})
            </Text>
          </View>
          <View style={styles.dot} />
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{nurse.distanceKm} km</Text>
          </View>
          <View style={styles.dot} />
          <View style={styles.metaItem}>
            <Ionicons name="briefcase-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{nurse.experienceYears}y</Text>
          </View>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.rate}>
            ₹{nurse.hourlyRate}
            <Text style={styles.rateUnit}>/hr</Text>
          </Text>
          <View
            style={[
              styles.availPill,
              { backgroundColor: nurse.available ? Colors.successBg : Colors.errorBg },
            ]}
          >
            <View
              style={[
                styles.availDot,
                { backgroundColor: nurse.available ? Colors.success : Colors.error },
              ]}
            />
            <Text
              style={[
                styles.availText,
                { color: nurse.available ? Colors.success : Colors.error },
              ]}
            >
              {nurse.available ? 'Available' : 'Busy'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { ...Typography.h4, color: Colors.textPrimary, flexShrink: 1 },
  spec: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.small, color: Colors.textSecondary, marginLeft: 4 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border, marginHorizontal: 8 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rate: { ...Typography.h4, color: Colors.primary, fontWeight: '800' as const },
  rateUnit: { ...Typography.small, color: Colors.textTertiary, fontWeight: '500' as const },
  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  availDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  availText: { ...Typography.caption, fontSize: 9 },
});
