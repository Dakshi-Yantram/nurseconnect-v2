import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VisitTimeline } from '../../components/VisitTimeline';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function Tracking() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookings = useStore((s) => s.bookings);
  const updateStatus = useStore((s) => s.updateBookingStatus);
  const booking = bookings.find((b) => b.id === id) || bookings[0];

  const [progress, setProgress] = useState(2); // 0..4

  // ----- Tracking-availability gate (1-hour rule) -----
  const startTime = React.useMemo(() => {
    if (!booking?.date) return null;
    const d = new Date(booking.date);
    if (Number.isNaN(d.getTime())) return null;
    if (booking.slot) {
      const m = String(booking.slot).match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/i);
      if (m) {
        let h = parseInt(m[1], 10);
        const mins = m[2] ? parseInt(m[2], 10) : 0;
        const mer = (m[3] || '').toUpperCase();
        if (mer === 'PM' && h < 12) h += 12;
        if (mer === 'AM' && h === 12) h = 0;
        d.setHours(h, mins, 0, 0);
      }
    }
    return d;
  }, [booking?.date, booking?.slot]);
  const minutesToStart = startTime ? Math.round((startTime.getTime() - Date.now()) / 60000) : null;
  const isInProgress = booking?.status === 'active' || booking?.status === 'enroute';
  const isVisitDone = booking?.status === 'completed';
  const trackingUnlocked =
    isInProgress || isVisitDone || (minutesToStart !== null && minutesToStart <= 60);
  // A worker is considered assigned when nurseId is something other than the "unassigned" placeholder
  const workerAssigned = !!booking?.nurseId && booking?.nurseId !== 'unassigned';

  useEffect(() => {
    if (booking?.status === 'enroute') setProgress(1);
    else if (booking?.status === 'active') setProgress(2);
    else if (booking?.status === 'completed') setProgress(4);
    else setProgress(0);
  }, [booking?.status]);

  const steps = [
    { key: 'confirmed', label: 'Booking confirmed', time: '10:00 AM', done: progress >= 0, active: progress === 0 },
    { key: 'enroute', label: 'Nurse en-route', time: '10:15 AM', done: progress >= 1, active: progress === 1 },
    { key: 'arrived', label: 'Nurse arrived & started', time: '10:30 AM', done: progress >= 2, active: progress === 2 },
    { key: 'care', label: 'Care in progress', time: progress >= 3 ? '10:45 AM' : undefined, done: progress >= 3, active: progress === 3 },
    { key: 'done', label: 'Visit completed', time: progress >= 4 ? '11:30 AM' : undefined, done: progress >= 4, active: progress === 4 },
  ];

  const advance = () => {
    if (progress < 4) {
      setProgress((p) => p + 1);
      const newStatus = progress + 1 === 4 ? 'completed' : progress + 1 === 1 ? 'enroute' : 'active';
      updateStatus(booking.id, newStatus as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="tracking-screen" edges={['top']}>
      <OfflineBanner />
      {/* Custom header with explicit dashboard reset (no stack walk-back through booking/payment) */}
      <View style={styles.headerWrap}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.replace('/(family)/dashboard')}
          testID="tracking-back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Visit</Text>
          <Text style={styles.headerSub}>#{booking?.id?.toUpperCase()}</Text>
        </View>
        <View style={styles.headerIconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
        {/* Tracking-availability gate (1 hour before visit) */}
        {!trackingUnlocked ? (
          <View style={[styles.timelineCard, { alignItems: 'center', padding: 24 }]} testID="tracking-locked">
            <Ionicons name="time-outline" size={36} color={Colors.primary} />
            <Text style={[styles.timelineTitle, { marginTop: 12, textAlign: 'center' }]}>
              Live tracking will be available 1 hour before your visit.
            </Text>
            <Text style={[styles.mapSub, { textAlign: 'center', marginTop: 6 }]}>
              {minutesToStart !== null && minutesToStart > 60
                ? `Opens in ${Math.floor(minutesToStart / 60)}h ${minutesToStart % 60}m`
                : 'Check back closer to your visit time'}
            </Text>
            <View style={{ height: 16 }} />
            <GradientButton
              title="View Booking"
              variant="outline"
              onPress={() => router.replace({ pathname: '/visit/[id]', params: { id: booking?.id } })}
              testID="locked-view-booking"
            />
          </View>
        ) : !workerAssigned && !isInProgress && !isVisitDone ? (
          <View style={[styles.timelineCard, { alignItems: 'center', padding: 24 }]} testID="assignment-in-progress">
            <Ionicons name="people-circle-outline" size={36} color={Colors.accent} />
            <Text style={[styles.timelineTitle, { marginTop: 12, textAlign: 'center' }]}>
              Assignment in progress.
            </Text>
            <Text style={[styles.mapSub, { textAlign: 'center', marginTop: 6 }]}>
              Our support team is monitoring this booking.
            </Text>
            <View style={{ height: 16 }} />
            <GradientButton
              title="Contact support"
              variant="outline"
              onPress={() => router.push('/support')}
              testID="contact-support"
            />
          </View>
        ) : (
        <>
        {/* Map placeholder */}
        <LinearGradient
          colors={Gradients.softBanner as any}
          style={styles.map}
        >
          <Ionicons name="navigate" size={40} color={Colors.primary} />
          <Text style={styles.mapTxt}>Live tracking active</Text>
          <Text style={styles.mapSub}>Nurse is 1.2 km away · ETA 8 min</Text>
        </LinearGradient>

        {/* Nurse card */}
        <View style={styles.nurseCard}>
          <Image source={{ uri: booking?.nurseAvatar }} style={styles.avatar} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{booking?.nurseName}</Text>
            <Text style={styles.role}>{booking?.careTitle} · {booking?.duration}h</Text>
          </View>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="call" size={18} color={Colors.success} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.infoBg, marginLeft: 8 }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Visit progress</Text>
          <VisitTimeline steps={steps} />
        </View>

        <GradientButton
          title={progress >= 4 ? 'View care notes' : 'Simulate next step'}
          onPress={() => {
            if (progress >= 4) {
              router.replace({ pathname: '/visit/[id]', params: { id: booking?.id } });
            } else {
              advance();
            }
          }}
          testID="advance-step-btn"
        />
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  map: {
    height: 200,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  mapTxt: { ...Typography.h4, color: Colors.primaryDark, marginTop: 12 },
  mapSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 4 },
  nurseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    marginTop: 16,
    ...Shadows.card,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  name: { ...Typography.h4, color: Colors.textPrimary },
  role: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginTop: 16,
    ...Shadows.card,
  },
  timelineTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.bgApp,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '700' as const },
  headerSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
