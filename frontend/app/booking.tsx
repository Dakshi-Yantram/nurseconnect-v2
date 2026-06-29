import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { InputField } from '../components/InputField';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { CARE_TYPES } from '../constants/careTypes';

const SLOTS = ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'];
const DURATIONS = [1, 2, 4, 8];

const buildDays = () => {
  const days: { date: Date; label: string; sub: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      sub: d.getDate().toString(),
    });
  }
  return days;
};

export default function Booking() {
  const router = useRouter();
  const draft = useStore((s) => s.draftBooking);
  const setDraft = useStore((s) => s.setDraftBooking);

  const days = useMemo(buildDays, []);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<string>('10:00 AM');
  const [duration, setDuration] = useState<number>(1);
  const [address, setAddress] = useState('Flat 401, Sapphire Heights, Bandra West');
  const [notes, setNotes] = useState('');

  const care = CARE_TYPES.find((c) => c.id === draft?.careTypeId) || CARE_TYPES[0];
  const baseRate = care.baseRate;
  const cost = baseRate * duration;
  const subsidy = Math.round(cost * 0.2);
  const platformFee = 49;
  const total = cost - subsidy + platformFee;

  const next = () => {
    if (!address.trim()) {
      Alert.alert('Add an address');
      return;
    }
    setDraft({
      ...(draft || {}),
      date: days[dayIdx].date.toISOString(),
      slot,
      duration,
      address,
      notes,
      cost,
      subsidy,
      netCost: total,
    });
    router.push('/payment');
  };

  return (
    <SafeAreaView style={styles.safe} testID="booking-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Confirm Booking" subtitle={`${care.title} with ${draft?.nurseName || ''}`} />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 140 }}>
        {/* Date */}
        <Text style={styles.sec}>Choose date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.day, dayIdx === i && styles.dayActive]}
              onPress={() => setDayIdx(i)}
              testID={`day-${i}`}
            >
              <Text style={[styles.dayLabel, dayIdx === i && { color: '#fff' }]}>{d.label}</Text>
              <Text style={[styles.dayNum, dayIdx === i && { color: '#fff' }]}>{d.sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Slot */}
        <Text style={styles.sec}>Time slot</Text>
        <View style={styles.slotsGrid}>
          {SLOTS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.slot, slot === s && styles.slotActive]}
              onPress={() => setSlot(s)}
              testID={`slot-${s}`}
            >
              <Text style={[styles.slotTxt, slot === s && { color: '#fff' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <Text style={styles.sec}>Duration (hours)</Text>
        <View style={styles.durRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dur, duration === d && styles.durActive]}
              onPress={() => setDuration(d)}
              testID={`duration-${d}`}
            >
              <Text style={[styles.durTxt, duration === d && { color: '#fff' }]}>{d}h</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Address */}
        <Text style={styles.sec}>Service address</Text>
        <InputField
          placeholder="Enter address"
          value={address}
          onChangeText={setAddress}
          iconLeft="location-outline"
          testID="booking-address"
        />

        <Text style={styles.sec}>Special instructions (optional)</Text>
        <InputField
          placeholder="e.g. Patient is bedridden, has dementia…"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          testID="booking-notes"
        />

        {/* Cost */}
        <View style={styles.costCard}>
          <Text style={styles.costTitle}>Cost breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costL}>
              {care.title} × {duration}h
            </Text>
            <Text style={styles.costR}>₹{cost}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costL}>Platform fee</Text>
            <Text style={styles.costR}>₹{platformFee}</Text>
          </View>
          <View style={styles.costRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="ribbon" size={14} color={Colors.accent} />
              <Text style={[styles.costL, { color: Colors.accent }]}>BPL subsidy (20%)</Text>
            </View>
            <Text style={[styles.costR, { color: Colors.accent }]}>−₹{subsidy}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Total</Text>
            <Text style={styles.totalR}>₹{total}</Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <GradientButton title={`Pay ₹${total}`} onPress={next} testID="proceed-payment-btn" />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: 20, marginBottom: 8 },
  day: {
    width: 60,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayLabel: { ...Typography.caption, color: Colors.textSecondary },
  dayNum: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 2 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  slotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
  durRow: { flexDirection: 'row', gap: 8 },
  dur: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  durActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  durTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
  costCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    marginTop: 24,
    ...Shadows.card,
  },
  costTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  costL: { ...Typography.body, color: Colors.textSecondary },
  costR: { ...Typography.bodyBold, color: Colors.textPrimary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalL: { ...Typography.h4, color: Colors.textPrimary },
  totalR: { ...Typography.h2, color: Colors.primary, fontWeight: '800' as const },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
