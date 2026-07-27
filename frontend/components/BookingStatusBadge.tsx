import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, StatusStyles, Typography } from '../constants/theme';
import { BOOKING_STATUS_LABEL, badgeToneFor } from '../lib/booking-domain';
import type { BookingStatus } from '../types';

interface Props {
  status: BookingStatus;
  testID?: string;
}

/**
 * Badge driven by the backend status, so the label is precise ("Nurse
 * arrived", "Finding a new nurse") rather than the coarse colour bucket.
 */
export const BookingStatusBadge: React.FC<Props> = ({ status, testID }) => {
  const tone = StatusStyles[badgeToneFor(status)];
  const label = BOOKING_STATUS_LABEL[status] ?? status;

  return (
    <View
      style={[styles.badge, { backgroundColor: tone.bg }]}
      testID={testID || `status-${status}`}
    >
      <View style={[styles.dot, { backgroundColor: tone.text }]} />
      <Text style={[styles.text, { color: tone.text }]} numberOfLines={1}>
        {label}
      </Text>
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
    maxWidth: 160,
    backgroundColor: Colors.surfaceAlt,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { ...Typography.caption, fontSize: 10, fontWeight: '700' as const },
});
