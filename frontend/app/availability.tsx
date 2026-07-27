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
import { workerSelfService } from '../services/worker-self.service';

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

  const load = useCallback(async () => {
    try {
      await loadWorkerProfileAPI();
    } catch {
      // The screen still renders; the save buttons surface any real failure.
    } finally {
      setLoading(false);
    }
  }, [loadWorkerProfileAPI]);

  useEffect(() => {
    load();
  }, [load]);

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
});
