import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Availability() {
  const availability = useStore((s) => s.availability);
  const toggle = useStore((s) => s.toggleAvailability);

  const activeCount = DAYS.filter((d) => availability[d]).length;

  return (
    <SafeAreaView style={styles.safe} testID="availability-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Availability" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLab}>Available days</Text>
            <Text style={styles.summaryVal}>{activeCount} / 7</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.dot} />
            <Text style={styles.statusTxt}>Accepting visits</Text>
          </View>
        </View>

        <Text style={styles.section}>Weekly schedule</Text>
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={styles.dayRow}
            onPress={() => toggle(d)}
            testID={`day-${d}`}
          >
            <Ionicons name="calendar-outline" size={20} color={availability[d] ? Colors.success : Colors.textTertiary} />
            <Text style={[styles.dayName, !availability[d] && { color: Colors.textTertiary }]}>{d}</Text>
            <Text style={styles.daySlots}>{availability[d] ? '08:00 AM – 08:00 PM' : 'Off'}</Text>
            <View style={[styles.toggle, { backgroundColor: availability[d] ? Colors.success : Colors.border }]}>
              <View style={[styles.toggleKnob, availability[d] && { transform: [{ translateX: 18 }] }]} />
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.section}>Time-off requests</Text>
        <TouchableOpacity
          style={styles.timeOff}
          onPress={() => Alert.alert('Request submitted', 'Time-off request sent to ops')}
          testID="time-off-btn"
        >
          <Ionicons name="airplane-outline" size={20} color={Colors.primary} />
          <Text style={styles.timeOffTxt}>Request a leave</Text>
        </TouchableOpacity>

        <GradientButton
          title="Save schedule"
          onPress={() => Alert.alert('Schedule saved', 'Your availability has been updated')}
          testID="availability-save"
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, ...Shadows.card },
  summaryLab: { ...Typography.caption, color: Colors.textTertiary },
  summaryVal: { ...Typography.h2, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.successBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusTxt: { ...Typography.small, color: Colors.success, fontWeight: '700' as const },
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.lg, marginBottom: 8, gap: 12 },
  dayName: { ...Typography.bodyBold, color: Colors.textPrimary, width: 50 },
  daySlots: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  toggle: { width: 42, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  timeOff: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.lg, ...Shadows.card },
  timeOffTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
});
