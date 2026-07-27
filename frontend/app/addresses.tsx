/**
 * Saved service addresses.
 *
 * Coordinates matter here: dispatch measures the nurse-search radius from the
 * address's lat/lng, so we capture the device location when the user adds an
 * address from where care will be delivered. Without coordinates the booking
 * still works, but it falls back to the profile's city and matching is coarser.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Header } from '../components/Header';
import { InputField } from '../components/InputField';
import { GradientButton } from '../components/GradientButton';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import {
  addressesService,
  formatAddress,
  type AddressInput,
  type ConsumerAddress,
} from '../services/addresses.service';

const LABELS = ['Home', 'Work', 'Parents', 'Other'];

const EMPTY_FORM: AddressInput = {
  label: 'Home',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  recipient_name: '',
  recipient_phone: '',
};

export default function Addresses() {
  const addresses = useStore((s) => s.addresses);
  const state = useStore((s) => s.loadState.addresses);
  const loadAddresses = useStore((s) => s.loadAddresses);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumerAddress | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY_FORM);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAddresses().catch(() => {});
    }, [loadAddresses]),
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCoords(null);
    setEditorOpen(true);
  };

  const openEdit = (a: ConsumerAddress) => {
    setEditing(a);
    setForm({
      label: a.label,
      line1: a.line1,
      line2: a.line2 ?? '',
      landmark: a.landmark ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      pincode: a.pincode ?? '',
      recipient_name: a.recipient_name ?? '',
      recipient_phone: a.recipient_phone ?? '',
      is_default: a.is_default,
    });
    setCoords(a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null);
    setEditorOpen(true);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow location access so we can match you with the closest available nurse. You can still save the address without it.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      // Fill in whatever the reverse geocoder can tell us, but never overwrite
      // something the user already typed.
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (place) {
          setForm((f) => ({
            ...f,
            city: f.city || place.city || place.subregion || '',
            state: f.state || place.region || '',
            pincode: f.pincode || place.postalCode || '',
            line1: f.line1 || [place.name, place.street].filter(Boolean).join(', '),
          }));
        }
      } catch {
        // Coordinates alone are enough for dispatch.
      }
    } catch {
      Alert.alert('Could not get your location', 'Please enter the address manually.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!form.line1?.trim()) {
      Alert.alert('Address needed', 'Enter at least the flat / building and street.');
      return;
    }
    setSaving(true);
    try {
      const payload: AddressInput = {
        ...form,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };
      if (editing) {
        await addressesService.update(editing.id, payload);
      } else {
        await addressesService.create(payload);
      }
      await loadAddresses();
      setEditorOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save address', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (a: ConsumerAddress) => {
    try {
      await addressesService.setDefault(a.id);
      await loadAddresses();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const remove = (a: ConsumerAddress) => {
    Alert.alert('Delete this address?', formatAddress(a), [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await addressesService.remove(a.id);
            await loadAddresses();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="addresses-screen">
      <OfflineBanner />
      <Header
        title="Saved addresses"
        fallbackHref="/(family)/profile"
        rightIcon="add"
        onRightPress={openNew}
      />

      <AsyncBoundary
        state={state}
        isEmpty={addresses.length === 0}
        emptyTitle="No saved addresses"
        emptyDescription="Add the address where care will be delivered so we can find nurses nearby."
        emptyIcon="location-outline"
        emptyCtaTitle="Add address"
        onEmptyCtaPress={openNew}
        onRetry={() => loadAddresses()}
      >
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          {addresses.map((a) => (
            <View key={a.id} style={styles.card} testID={`address-${a.id}`}>
              <View style={styles.cardHead}>
                <View style={styles.labelChip}>
                  <Ionicons name="location" size={12} color={Colors.primary} />
                  <Text style={styles.labelTxt}>{a.label}</Text>
                </View>
                {a.is_default && (
                  <View style={styles.defaultChip}>
                    <Text style={styles.defaultTxt}>Default</Text>
                  </View>
                )}
              </View>

              <Text style={styles.addrTxt}>{formatAddress(a)}</Text>
              {!!a.recipient_name && (
                <Text style={styles.recipient}>
                  For {a.recipient_name}
                  {a.recipient_phone ? ` · ${a.recipient_phone}` : ''}
                </Text>
              )}
              {a.latitude == null && (
                <View style={styles.warnRow}>
                  <Ionicons name="warning-outline" size={13} color={Colors.warning} />
                  <Text style={styles.warnTxt}>
                    No precise location saved — nurse matching will be less accurate.
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                {!a.is_default && (
                  <TouchableOpacity onPress={() => makeDefault(a)} style={styles.action}>
                    <Ionicons name="star-outline" size={15} color={Colors.primary} />
                    <Text style={styles.actionTxt}>Set default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openEdit(a)} style={styles.action}>
                  <Ionicons name="create-outline" size={15} color={Colors.primary} />
                  <Text style={styles.actionTxt}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(a)} style={styles.action}>
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  <Text style={[styles.actionTxt, { color: Colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </AsyncBoundary>

      {/* ------------------------------------------------------ editor ---- */}
      <Modal
        visible={editorOpen}
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header
            title={editing ? 'Edit address' : 'Add address'}
            showBack={false}
            rightIcon="close"
            onRightPress={() => setEditorOpen(false)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Label</Text>
              <View style={styles.chipRow}>
                {LABELS.map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.chip, form.label === l && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, label: l }))}
                  >
                    <Text style={[styles.chipTxt, form.label === l && { color: '#fff' }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.locateBtn}
                onPress={useCurrentLocation}
                disabled={locating}
                testID="use-current-location"
              >
                <Ionicons
                  name={coords ? 'checkmark-circle' : 'navigate'}
                  size={18}
                  color={coords ? Colors.success : Colors.primary}
                />
                <Text style={[styles.locateTxt, coords && { color: Colors.success }]}>
                  {locating
                    ? 'Getting your location…'
                    : coords
                      ? 'Precise location saved'
                      : 'Use my current location'}
                </Text>
              </TouchableOpacity>

              <InputField
                label="Flat / building & street"
                placeholder="Flat 401, Sapphire Heights, Bandra West"
                value={form.line1}
                onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))}
                testID="addr-line1"
              />
              <InputField
                label="Area (optional)"
                placeholder="Near the metro station"
                value={form.line2 ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, line2: v }))}
              />
              <InputField
                label="Landmark (optional)"
                placeholder="Opposite the community park"
                value={form.landmark ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, landmark: v }))}
              />
              <InputField
                label="City"
                placeholder="Hyderabad"
                value={form.city ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
              />
              <InputField
                label="State"
                placeholder="Telangana"
                value={form.state ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
              />
              <InputField
                label="PIN code"
                placeholder="500001"
                keyboardType="number-pad"
                maxLength={6}
                value={form.pincode ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, pincode: v }))}
              />

              <Text style={styles.sectionNote}>
                Booking for someone else? Add their details so the nurse knows who to ask for.
              </Text>
              <InputField
                label="Recipient name (optional)"
                placeholder="Who the nurse should ask for"
                value={form.recipient_name ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, recipient_name: v }))}
              />
              <InputField
                label="Recipient phone (optional)"
                placeholder="+91 98xxxxxxxx"
                keyboardType="phone-pad"
                value={form.recipient_phone ?? ''}
                onChangeText={(v) => setForm((f) => ({ ...f, recipient_phone: v }))}
              />

              <TouchableOpacity
                style={styles.defaultRow}
                onPress={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
              >
                <View style={[styles.checkbox, form.is_default && styles.checkboxOn]}>
                  {form.is_default && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.defaultRowTxt}>Use this as my default address</Text>
              </TouchableOpacity>

              <GradientButton
                title={editing ? 'Save changes' : 'Add address'}
                onPress={save}
                loading={saving}
                style={{ marginTop: Spacing.md }}
                testID="addr-save"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
  defaultChip: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  defaultTxt: { ...Typography.caption, color: Colors.success, fontWeight: '700' as const },
  addrTxt: { ...Typography.body, color: Colors.textSecondary, marginTop: 8, lineHeight: 20 },
  recipient: { ...Typography.small, color: Colors.textTertiary, marginTop: 6 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  warnTxt: { ...Typography.caption, color: Colors.warning, flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionTxt: { ...Typography.small, color: Colors.primary, fontWeight: '600' as const },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.infoBg,
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  locateTxt: { ...Typography.body, color: Colors.primary, fontWeight: '600' as const },
  sectionNote: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    lineHeight: 17,
  },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  defaultRowTxt: { ...Typography.body, color: Colors.textPrimary },
});
