/**
 * Availability and coverage area.
 *
 * Both settings feed dispatch directly: only nurses marked `online` are
 * offered new visits, and the service radius plus base coordinates decide
 * which bookings fall inside the search wave. The old screen toggled a
 * purely local day-of-week grid that was never sent anywhere.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { workerSelfService, type AvailabilitySlot } from '../services/worker-self.service';

const DAYS: { id: number; label: string; short: string }[] = [
  { id: 0, label: 'Monday', short: 'Mon' },
  { id: 1, label: 'Tuesday', short: 'Tue' },
  { id: 2, label: 'Wednesday', short: 'Wed' },
  { id: 3, label: 'Thursday', short: 'Thu' },
  { id: 4, label: 'Friday', short: 'Fri' },
  { id: 5, label: 'Saturday', short: 'Sat' },
  { id: 6, label: 'Sunday', short: 'Sun' },
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const STATES: {
  id: 'online' | 'offline' | 'busy' | 'on_leave';
  label: string;
  description: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'online',
    label: 'Available',
    description: 'You’ll be offered new visits that match your services and area.',
    color: Colors.success,
    icon: 'checkmark-circle',
  },
  {
    id: 'busy',
    label: 'Busy',
    description: 'Keep your accepted visits, but pause new requests for now.',
    color: Colors.warning,
    icon: 'time',
  },
  {
    id: 'offline',
    label: 'Offline',
    description: 'You won’t appear in nurse searches or receive requests.',
    color: Colors.textSecondary,
    icon: 'moon',
  },
  {
    id: 'on_leave',
    label: 'On leave',
    description: 'Extended time off. Nothing will be dispatched to you.',
    color: Colors.accent,
    icon: 'airplane',
  },
];

const RADII = [5, 8, 12, 20, 30];

export default function Availability() {
  const workerProfile = useStore((s) => s.workerProfile);
  const loadWorkerProfileAPI = useStore((s) => s.loadWorkerProfileAPI);
  const updateAvailabilityAPI = useStore((s) => s.updateAvailabilityAPI);

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [locating, setLocating] = useState(false);
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(12);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ----- Weekly working-hours schedule -----
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('17:00');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      await loadWorkerProfileAPI();
    } catch {
      // The screen still renders; the save buttons surface any real failure.
    } finally {
      setLoading(false);
    }
    try {
      const existing = await workerSelfService.availabilitySlots();
      setSlots(existing);
    } catch {
      // Schedule editor still works locally; save will retry the write.
    } finally {
      setScheduleLoaded(true);
    }
  }, [loadWorkerProfileAPI]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (id: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSlot = () => {
    if (!TIME_RE.test(slotStart) || !TIME_RE.test(slotEnd)) {
      Alert.alert('Check the time', 'Use 24-hour HH:MM, for example 09:00 and 17:00.');
      return;
    }
    if (slotEnd <= slotStart) {
      Alert.alert('Check the time', 'End time must be after start time.');
      return;
    }
    if (selectedDays.size === 0) {
      Alert.alert('Pick a day', 'Select at least one day for this slot.');
      return;
    }
    const additions: AvailabilitySlot[] = Array.from(selectedDays).map((day_of_week) => ({
      day_of_week,
      start_time: slotStart,
      end_time: slotEnd,
    }));
    setSlots((prev) => [...prev, ...additions]);
    setSelectedDays(new Set());
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const saved = await workerSelfService.saveAvailabilitySlots(slots);
      setSlots(saved);
      Alert.alert('Saved', 'Your working hours have been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const slotsByDay = DAYS.map((d) => ({
    day: d,
    entries: slots
      .map((s, index) => ({ ...s, index }))
      .filter((s) => s.day_of_week === d.id)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  // Seed the form from the profile once it arrives, without clobbering edits.
  useEffect(() => {
    if (!workerProfile) return;
    setCity((c) => c || workerProfile.base_city || '');
    setRadius((r) => workerProfile.service_radius_km ?? r);
    setCoords((c) => {
      if (c) return c;
      const { home_latitude: lat, home_longitude: lng } = workerProfile;
      return lat != null && lng != null ? { lat, lng } : null;
    });
  }, [workerProfile]);

  const setStatus = async (next: 'online' | 'offline' | 'busy' | 'on_leave') => {
    setSavingStatus(true);
    try {
      await updateAvailabilityAPI(next);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'We use your base location to work out which visits are within your travel radius.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (place && !city) setCity(place.city || place.subregion || '');
      } catch {
        // Coordinates alone are what dispatch needs.
      }
    } catch {
      Alert.alert('Could not get your location', 'Please try again or enter your city manually.');
    } finally {
      setLocating(false);
    }
  };

  const saveArea = async () => {
    setSavingArea(true);
    try {
      await workerSelfService.setServiceArea({
        base_city: city.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        service_radius_km: radius,
      });
      await loadWorkerProfileAPI();
      Alert.alert('Saved', 'Your coverage area has been updated.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSavingArea(false);
    }
  };

  const current = workerProfile?.availability ?? 'offline';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Availability" fallbackHref="/(nurse)/profile" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="availability-screen">
      <OfflineBanner />
      <Header title="Availability & area" fallbackHref="/(nurse)/profile" />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Current status</Text>
        {STATES.map((s) => {
          const active = current === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.stateCard, active && { borderColor: s.color }]}
              onPress={() => setStatus(s.id)}
              disabled={savingStatus}
              testID={`state-${s.id}`}
            >
              <Ionicons
                name={s.icon}
                size={22}
                color={active ? s.color : Colors.textTertiary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.stateLabel, active && { color: s.color }]}>{s.label}</Text>
                <Text style={styles.stateDesc}>{s.description}</Text>
              </View>
              <View style={[styles.radio, active && { borderColor: s.color }]}>
                {active && <View style={[styles.radioDot, { backgroundColor: s.color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Working hours</Text>
        <Text style={styles.sectionNote}>
          Tell us the days and times you're generally open to working. This is your declared
          schedule — you can still go Available/Busy/Offline above at any moment.
        </Text>

        <Text style={styles.fieldLabel}>Days</Text>
        <View style={styles.chipRow}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, selectedDays.has(d.id) && styles.chipActive]}
              onPress={() => toggleDay(d.id)}
              testID={`day-${d.id}`}
            >
              <Text style={[styles.chipTxt, selectedDays.has(d.id) && { color: '#fff' }]}>
                {d.short}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <InputField
              label="From"
              placeholder="09:00"
              value={slotStart}
              onChangeText={setSlotStart}
              testID="slot-start"
            />
          </View>
          <View style={{ flex: 1 }}>
            <InputField
              label="To"
              placeholder="17:00"
              value={slotEnd}
              onChangeText={setSlotEnd}
              testID="slot-end"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.addSlotBtn} onPress={addSlot} testID="add-slot">
          <Ionicons name="add-circle" size={18} color={Colors.teal} />
          <Text style={styles.addSlotTxt}>Add this slot to selected days</Text>
        </TouchableOpacity>

        {scheduleLoaded && slots.length === 0 && (
          <Text style={styles.emptyScheduleTxt}>
            No working hours set yet — pick days and a time above, then add.
          </Text>
        )}

        {slotsByDay
          .filter((g) => g.entries.length > 0)
          .map((g) => (
            <View key={g.day.id} style={styles.dayGroup}>
              <Text style={styles.dayGroupLabel}>{g.day.label}</Text>
              <View style={styles.chipRow}>
                {g.entries.map((s) => (
                  <View key={`${s.index}`} style={styles.slotPill} testID={`slot-${s.index}`}>
                    <Text style={styles.slotPillTxt}>
                      {s.start_time}–{s.end_time}
                    </Text>
                    <TouchableOpacity onPress={() => removeSlot(s.index)} testID={`remove-slot-${s.index}`}>
                      <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))}

        <GradientButton
          title="Save working hours"
          onPress={saveSchedule}
          loading={savingSchedule}
          style={{ marginTop: Spacing.md }}
          testID="save-schedule"
        />

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Where you work</Text>
        <Text style={styles.sectionNote}>
          We only offer you visits within your travel radius of this location.
        </Text>

        <TouchableOpacity
          style={styles.locateBtn}
          onPress={useMyLocation}
          disabled={locating}
          testID="use-my-location"
        >
          <Ionicons
            name={coords ? 'checkmark-circle' : 'navigate'}
            size={18}
            color={coords ? Colors.success : Colors.teal}
          />
          <Text style={[styles.locateTxt, coords && { color: Colors.success }]}>
            {locating
              ? 'Getting your location…'
              : coords
                ? 'Base location saved'
                : 'Set my base location'}
          </Text>
        </TouchableOpacity>

        <InputField
          label="Base city"
          placeholder="Hyderabad"
          value={city}
          onChangeText={setCity}
          iconLeft="business-outline"
          testID="base-city"
        />

        <Text style={styles.fieldLabel}>Travel radius</Text>
        <View style={styles.chipRow}>
          {RADII.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, radius === r && styles.chipActive]}
              onPress={() => setRadius(r)}
              testID={`radius-${r}`}
            >
              <Text style={[styles.chipTxt, radius === r && { color: '#fff' }]}>{r} km</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!coords && (
          <View style={styles.warnRow}>
            <Ionicons name="warning-outline" size={15} color={Colors.warning} />
            <Text style={styles.warnTxt}>
              Without a base location we can’t measure distance, so you may miss nearby visits.
            </Text>
          </View>
        )}

        <GradientButton
          title="Save coverage area"
          onPress={saveArea}
          loading={savingArea}
          style={{ marginTop: Spacing.lg }}
          testID="save-area"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionNote: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  stateLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
  stateDesc: { ...Typography.small, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#CCFBF1',
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  locateTxt: { ...Typography.body, color: Colors.teal, fontWeight: '600' as const },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  warnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  warnTxt: { ...Typography.small, color: Colors.warning, flex: 1, lineHeight: 17 },
  timeRow: { flexDirection: 'row', gap: Spacing.sm },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  addSlotTxt: { ...Typography.small, color: Colors.teal, fontWeight: '600' as const },
  emptyScheduleTxt: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    fontStyle: 'italic' as const,
  },
  dayGroup: { marginBottom: Spacing.sm },
  dayGroupLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotPillTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
});
