import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

/**
 * Booking-Confirmed screen.
 *
 * Spec:
 *  - Title: "Booking confirmed"
 *  - Show service name, patient name, date/time
 *  - Copy: "Care professional will be assigned before your visit."
 *  - Two CTAs only: View Booking, Go Home
 *  - Auto-redirect to Home after 3 seconds if user does nothing
 *  - Reach via router.replace + dismissAll so payment/package screens are NOT in back-stack
 */
export default function PaymentSuccess() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookings = useStore((s) => s.bookings);
  const patients = useStore((s) => s.patients);
  const user = useStore((s) => s.user);
  const booking = bookings.find((b) => b.id === id) || bookings[0];

  const patient = booking?.patientId
    ? patients.find((p) => p.id === booking.patientId)
    : undefined;
  const patientName = (patient as any)?.full_name || user?.name || 'Patient';

  const scale = React.useRef(new Animated.Value(0)).current;
  // Timer ref so user-initiated CTA taps can cancel the 3s auto-redirect
  // (prevents duplicate navigation execution + race conditions).
  const autoRedirectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutoRedirect = React.useCallback(() => {
    if (autoRedirectTimer.current) {
      clearTimeout(autoRedirectTimer.current);
      autoRedirectTimer.current = null;
    }
  }, []);

  /** Reset navigation: dismiss any modal/stack frames and replace with dashboard so
   *  the package/payment screens can never be reached via back button. */
  const resetAndGo = React.useCallback(
    (next?: { pathname: string; params?: any }) => {
      // First, kill the pending auto-redirect so it can't fire a second navigation.
      clearAutoRedirect();
      try {
        // dismissAll is available in expo-router 6+
        const r = router as any;
        if (typeof r.dismissAll === 'function') r.dismissAll();
      } catch {
        // ignore — replace below still applies
      }
      router.replace('/(family)/dashboard');
      if (next) {
        // small delay lets the dashboard mount before stacking next on top
        setTimeout(() => router.push(next as any), 0);
      }
    },
    [router, clearAutoRedirect],
  );

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    // Auto-redirect to Home after 3 seconds if user does nothing.
    autoRedirectTimer.current = setTimeout(() => {
      autoRedirectTimer.current = null;
      resetAndGo();
    }, 3000);
    return () => clearAutoRedirect();
  }, [scale, resetAndGo, clearAutoRedirect]);

  const dateLabel = booking?.date
    ? new Date(booking.date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      })
    : '';

  return (
    <SafeAreaView style={styles.safe} testID="booking-confirmed-screen">
      <LinearGradient
        colors={Gradients.successCard as any}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[styles.checkWrap, { transform: [{ scale }] }]}>
          <Ionicons name="checkmark" size={56} color={Colors.success} />
        </Animated.View>
        <Text style={styles.title} testID="booking-confirmed-title">
          Booking confirmed
        </Text>
        <Text style={styles.sub} testID="booking-confirmed-subtitle">
          Care professional will be assigned before your visit.
        </Text>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.l}>Service</Text>
          <Text style={styles.r} testID="confirmed-service">
            {booking?.careTitle || '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.l}>Patient</Text>
          <Text style={styles.r} testID="confirmed-patient">
            {patientName}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.l}>Date · Time</Text>
          <Text style={styles.r} testID="confirmed-datetime">
            {dateLabel} · {booking?.slot || ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.l}>Booking ID</Text>
          <Text style={styles.r} testID="confirmed-booking-id">
            #{(booking?.bookingRef || booking?.id || '').toString().toUpperCase()}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.l}>Amount paid</Text>
          <Text style={[styles.r, { color: Colors.success }]} testID="confirmed-amount">
            ₹{booking?.netCost ?? 0}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <GradientButton
          title="View Booking"
          onPress={() =>
            resetAndGo({ pathname: '/visit/[id]', params: { id: booking?.id || '' } })
          }
          testID="view-booking-btn"
        />
        <GradientButton
          title="Go Home"
          variant="outline"
          onPress={() => resetAndGo()}
          testID="go-home-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { padding: 32, alignItems: 'center', paddingTop: 64, paddingBottom: 56 },
  checkWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  title: { ...Typography.h1, color: '#fff', marginTop: 24, fontWeight: '800' as const },
  sub: { ...Typography.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.xl,
    padding: 18,
    ...Shadows.card,
    marginTop: -28,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  l: { ...Typography.body, color: Colors.textSecondary },
  r: { ...Typography.bodyBold, color: Colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  actions: { padding: Spacing.lg, gap: 10 },
});
