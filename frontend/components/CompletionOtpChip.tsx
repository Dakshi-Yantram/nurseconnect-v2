import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { compositeCareService } from '../services/composite-care.service';

/**
 * Step 6's Completion_OTP — the mirror of VisitOtpChip, but for closing out
 * a Composite Care Package visit instead of starting it. Only shown while
 * the booking is `in_progress`; generation itself is gated server-side on
 * the post-procedure photo already being captured, so tapping "Generate"
 * before the nurse has finished simply surfaces that as a friendly message
 * rather than requiring the app to track photo state itself.
 */
interface Props {
  bookingId: string;
}

export const CompletionOtpChip: React.FC<Props> = ({ bookingId }) => {
  const [otp, setOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const generate = async () => {
    setLoading(true);
    setFailed(false);
    setNotReady(false);
    try {
      const res = await compositeCareService.generateCompletionOtp(bookingId);
      setOtp(res.otp);
    } catch (e: any) {
      const message = e?.detail?.message || e?.message || '';
      if (message.toLowerCase().includes('post-procedure photo')) {
        setNotReady(true);
      } else {
        setFailed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (otp) {
    return (
      <View style={styles.card} testID="completion-otp-chip">
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-done" size={16} color={Colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Your visit completion code</Text>
          <Text style={styles.hint}>Read this out to your nurse to close the visit</Text>
        </View>
        <Text style={styles.code}>{otp}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.wrap} onPress={generate} disabled={loading} testID="generate-completion-otp">
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name="checkmark-done-outline" size={16} color={Colors.primary} />
      )}
      <Text style={styles.retryTxt}>
        {notReady
          ? 'Nurse is still finishing up — tap to check again'
          : failed
          ? 'Could not generate code — tap to retry'
          : 'Get your visit completion code'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: 8,
  },
  retryTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.teal + '18',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...Typography.small, color: Colors.teal, fontWeight: '700' as const },
  hint: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  code: { ...Typography.h3, color: Colors.teal, fontWeight: '800' as const, letterSpacing: 4 },
});
