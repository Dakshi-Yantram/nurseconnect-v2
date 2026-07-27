import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radius, Typography, StatusStyles, StatusKey } from '../constants/theme';

interface Props {
  status: StatusKey;
  testID?: string;
}
export const StatusBadge: React.FC<Props> = ({ status, testID }) => {
  const s = StatusStyles[status] || {
  bg: "#E5E7EB",
  text: "#6B7280",
  label: "Unknown",
};
  return (
    <View
      style={[styles.badge, { backgroundColor: s.bg }]}
      testID={testID || `status-${status}`}
    >
      <View style={[styles.dot, { backgroundColor: s.text }]} />
      <Text style={[styles.text, { color: s.text }]}>{s.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { ...Typography.caption, fontSize: 10 },
});
