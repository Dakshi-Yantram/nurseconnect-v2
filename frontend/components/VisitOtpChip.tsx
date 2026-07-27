import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { visitsService } from '../services/visits.service';
import type { BookingStatus } from '../types';

/**
 * The visit-start code, shown on the consumer's booking once a nurse has
 * claimed it. The nurse types this same code into their app to start the
 * visit, so it is read aloud at the door — SMS delivery is best-effort and the
 * on-screen value is the one that counts.
 *
 * The code is generated server-side the moment a nurse accepts, so this just
 * reads the live one (the endpoint is idempotent and returns the remaining
 * TTL).
 */
const ELIGIBLE: BookingStatus[] = ['assigned', 'worker_en_route', 'worker_arrived', 'in_progress'];

interface Props {
  bookingId: string;
  status: BookingStatus;
}

export const VisitOtpChip: React.FC<Props> = ({ bookingId, status }) => {
  const [otp, setOtp] = useState<string | null>(null);
  /** Absolute expiry instant, so the countdown survives backgrounding. */
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  const eligible = ELIGIBLE.includes(status);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await visitsService.generateStartOtp(bookingId);
      setOtp(res?.otp ?? null);
      setExpiresAt(
        typeof res?.expires_in_seconds === 'number'
          ? Date.now() + res.expires_in_seconds * 1000
          : null,
      );
    } catch {
      // The rest of the card still works without the chip; offer a retry
      // rather than silently rendering nothing.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!eligible) return;
    if (fetchedFor.current === bookingId) return;
    fetchedFor.current = bookingId;
    load();
  }, [eligible, bookingId, load]);

  // Recompute from the wall clock each tick rather than decrementing, so a
  // backgrounded app doesn't show time the code no longer has.
  useEffect(() => {
    if (expiresAt === null) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!eligible) return null;

  if (loading) {
    return (
      <View style={styles.wrap} testID="visit-otp-loading">
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (failed || !otp) {
    return (
      <TouchableOpacity style={styles.wrap} onPress={load} testID="visit-otp-retry">
        <Ionicons name="refresh" size={14} color={Colors.textSecondary} />
        <Text style={styles.retryTxt}>Tap to load your visit code</Text>
      </TouchableOpacity>
    );
  }

  const expired = secondsLeft !== null && secondsLeft <= 0;
  const mm = secondsLeft != null ? Math.floor(secondsLeft / 60) : null;
  const ss = secondsLeft != null ? secondsLeft % 60 : null;

  if (expired) {
    return (
      <TouchableOpacity style={styles.wrap} onPress={load} testID="visit-otp-expired">
        <Ionicons name="refresh" size={14} color={Colors.warning} />
        <Text style={[styles.retryTxt, { color: Colors.warning }]}>
          Code expired — tap for a new one
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card} testID="visit-otp-chip">
      <View style={styles.iconWrap}>
        <Ionicons name="key" size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Your visit start code</Text>
        <Text style={styles.hint}>Read this out to your nurse when they arrive</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.code}>{otp}</Text>
        {mm != null && ss != null && (
          <Text style={styles.timer}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </Text>
        )}
      </View>
    </View>
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
  retryTxt: { ...Typography.small, color: Colors.textSecondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.infoBg,
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
  label: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  hint: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  code: {
    ...Typography.h3,
    color: Colors.primary,
    fontWeight: '800' as const,
    letterSpacing: 4,
  },
  timer: { ...Typography.caption, color: Colors.textSecondary },
});
