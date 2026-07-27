import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { Booking } from '../types';
import { BookingStatusBadge } from './BookingStatusBadge';
import { formatDay, formatTime, inr } from '../lib/format';

interface Props {
  booking: Booking;
  onPress?: () => void;
  showActions?: boolean;
  onCall?: () => void;
  onChat?: () => void;
  /** Extra content rendered above the footer, e.g. the visit-start code. */
  children?: React.ReactNode;
  testID?: string;
}

export const BookingCard: React.FC<Props> = ({
  booking,
  onPress,
  showActions,
  onCall,
  onChat,
  children,
  testID,
}) => {
  const assigned = booking.nurseId !== 'unassigned';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
      testID={testID || `booking-card-${booking.id}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.left}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons
              name={assigned ? 'account-heart' : 'account-clock'}
              size={22}
              color={Colors.primary}
            />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {booking.careTitle}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {assigned ? `with ${booking.nurseName}` : 'Matching you with a nurse'}
            </Text>
          </View>
        </View>
        <BookingStatusBadge status={booking.rawStatus} />
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatDay(booking.date)}</Text>
        </View>
        <View style={styles.detail}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(booking.slot)}</Text>
        </View>
        {booking.isUrgent && (
          <View style={styles.urgentChip}>
            <Ionicons name="flash" size={11} color={Colors.warning} />
            <Text style={styles.urgentTxt}>Urgent</Text>
          </View>
        )}
      </View>

      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
        <Text style={styles.address} numberOfLines={1}>
          {booking.address}
        </Text>
      </View>

      {children}

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.costLabel}>{booking.paid ? 'Paid' : 'Amount due'}</Text>
          <Text style={styles.cost}>{inr(booking.netCost)}</Text>
        </View>
        {showActions ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.infoBg }]}
              onPress={onChat}
              testID={`chat-${booking.id}`}
            >
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.successBg }]}
              onPress={onCall}
              testID={`call-${booking.id}`}
            >
              <Ionicons name="call-outline" size={18} color={Colors.success} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View details</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h4, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  urgentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  urgentTxt: { ...Typography.caption, color: Colors.warning, fontWeight: '700' as const },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  address: { ...Typography.small, color: Colors.textTertiary, flex: 1 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costLabel: { ...Typography.caption, color: Colors.textTertiary },
  cost: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 2 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewBtnText: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
