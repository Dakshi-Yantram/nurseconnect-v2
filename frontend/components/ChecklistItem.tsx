import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { KitItem } from '../types';

interface Props {
  item: KitItem;
  onToggle?: () => void;
}

export const ChecklistItem: React.FC<Props> = ({ item, onToggle }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onToggle}
    style={styles.row}
    testID={`kit-${item.id}`}
  >
    <View
      style={[
        styles.checkbox,
        item.checked && { backgroundColor: Colors.primary, borderColor: Colors.primary },
      ]}
    >
      {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text
        style={[
          styles.name,
          item.checked && { color: Colors.textTertiary, textDecorationLine: 'line-through' },
        ]}
      >
        {item.name}
      </Text>
      <Text style={styles.cat}>{item.category}</Text>
    </View>
    {item.required && (
      <View style={styles.badge}>
        <Text style={styles.badgeTxt}>Required</Text>
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' as const },
  cat: { ...Typography.small, color: Colors.textTertiary, marginTop: 2 },
  badge: { backgroundColor: Colors.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, color: Colors.warning, fontSize: 9 },
});
