/**
 * Booking creation.
 *
 * Everything here comes from the backend: the package (and its price), the
 * consumer's patients, and their saved addresses. The previous version made up
 * an hourly rate, a 20% "subsidy" and a ₹49 platform fee, then never called
 * the booking API at all — so nothing it showed matched what was charged, and
 * no nurse was ever dispatched.
 */
import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import {
  PrescriptionSupplyGate,
  PrescriptionSupplyResult,
} from '../components/PrescriptionSupplyGate';
import { compositeCareService } from '../services/composite-care.service';
import { InputField } from '../components/InputField';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { formatAddress } from '../services/addresses.service';
import { inr, to24HourTime } from '../lib/format';

const SLOTS = ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'];

/** Next 14 days, built in local time so "today" is the user's today. */
function buildDays() {
  const out: { date: Date; ymd: string; weekday: string; day: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    out.push({
      date: d,
      ymd,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: String(d.getDate()),
    });
  }
  return out;
}

export default function BookingScreen() {
  const router = useRouter();
  const { packageId } = useLocalSearchParams<{ packageId?: string }>();

  const packages = useStore((s) => s.packages);
  const patients = useStore((s) => s.patients);
  const addresses = useStore((s) => s.addresses);
  const loadPatients = useStore((s) => s.loadPatients);
  const loadAddresses = useStore((s) => s.loadAddresses);
  const loadPackages = useStore((s) => s.loadPackages);
  const createBookingAPI = useStore((s) => s.createBookingAPI);

  const days = useMemo(buildDays, []);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState(SLOTS[1]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Patients and addresses can be created from screens pushed on top of
      // this one, so re-read them each time this screen regains focus.
      loadPatients().catch(() => {});
      loadAddresses().catch(() => {});
      if (packages.length === 0) loadPackages().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadPatients, loadAddresses, loadPackages]),
  );

  // Default to the patient/address already on file so the common case is one tap.
  const effectivePatientId = patientId ?? patients[0]?.id ?? null;
  const effectiveAddressId =
    addressId ?? addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;

  const pkg = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  const price = useMemo(() => {
    if (!pkg) return 0;
    const packagePrice = parseFloat(pkg.package_price ?? '');
    if (!isNaN(packagePrice) && packagePrice > 0) return packagePrice;
    const perVisit = parseFloat(pkg.per_visit_price ?? '');
    return isNaN(perVisit) ? 0 : perVisit;
  }, [pkg]);

  const selectedAddress = addresses.find((a) => a.id === effectiveAddressId) ?? null;
  const selectedPatient = patients.find((p) => p.id === effectivePatientId) ?? null;

  // Which of the three booking flows this package takes.
  //   Workflow 1 — bundled procedural kit
  //   Workflow 2 — patient brings their own supplies (needs the guardrail)
  //   otherwise  — ordinary booking, no prescription gate
  const isComposite = !!pkg?.material_included;
  const isServiceOnly = !!pkg?.requires_prescription && !pkg?.material_included;
  const needsPrescriptionGate = isComposite || isServiceOnly;

  /** Shared guard for the three preconditions every flow needs. */
  const validate = (): boolean => {
    if (!pkg) {
      Alert.alert('Choose a care package', 'Go back and pick the care you need.');
      return false;
    }
    if (!effectivePatientId) {
      Alert.alert('Add a patient', 'Tell us who this visit is for before booking.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add patient', onPress: () => router.push('/patients') },
      ]);
      return false;
    }
    if (!effectiveAddressId) {
      Alert.alert('Add an address', 'We need a service address to dispatch a nurse.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add address', onPress: () => router.push('/addresses') },
      ]);
      return false;
    }
    return true;
  };

  const startBooking = () => {
    if (!validate()) return;
    if (needsPrescriptionGate) {
      setGateOpen(true);
      return;
    }
    submit();
  };

  /**
   * Workflows 1 & 2 — create the booking through the guarded endpoints, which
   * attach the prescription (and, for Workflow 2, the supply guardrail) and
   * park the booking in `prescription_pending` for pharmacist review.
   */
  const submitGuarded = async (result: PrescriptionSupplyResult) => {
    if (!pkg || !effectivePatientId || !selectedAddress) return;
    setSubmitting(true);
    try {
      const common = {
        package_id: pkg.id,
        patient_id: effectivePatientId,
        scheduled_date: days[dayIdx].ymd,
        scheduled_start_time: to24HourTime(slot),
        address_snapshot: selectedAddress as unknown as Record<string, any>,
        latitude: selectedAddress.latitude ?? 0,
        longitude: selectedAddress.longitude ?? 0,
        special_instructions: notes.trim() || undefined,
        prescription_base64: result.prescriptionBase64,
      };
      const created = result.supplyConfirmation
        ? await compositeCareService.createServiceOnlyBooking({
            ...common,
            supply_confirmation: result.supplyConfirmation,
            supply_photo_base64: result.supplyPhotoBase64,
          })
        : await compositeCareService.createBooking(common);
      setGateOpen(false);
      router.replace({ pathname: '/payment', params: { bookingId: created.id } });
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert(
        'Could not create booking',
        (typeof detail === 'string' ? detail : detail?.message) ||
          e?.message ||
          'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!validate() || !pkg || !effectivePatientId || !effectiveAddressId) return;

    setSubmitting(true);
    try {
      const created = await createBookingAPI({
        patient_id: effectivePatientId,
        package_id: pkg.id,
        booking_type: 'one_time',
        scheduled_date: days[dayIdx].ymd,
        scheduled_start_time: to24HourTime(slot),
        is_urgent: isUrgent,
        // A saved address carries the coordinates dispatch measures from, so
        // reference it rather than re-sending a snapshot.
        address_id: effectiveAddressId,
        special_instructions: notes.trim() || undefined,
      });
      router.replace({ pathname: '/payment', params: { bookingId: created.id } });
    } catch (e: any) {
      const detail = e?.detail?.detail ?? e?.detail;
      Alert.alert(
        'Could not create booking',
        (typeof detail === 'string' ? detail : detail?.message) ||
          e?.message ||
          'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!pkg) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Confirm booking" fallbackHref="/care-types" />
        <View style={styles.centered}>
          {packages.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTxt}>
                That care package is no longer available. Pick another one to continue.
              </Text>
              <GradientButton
                title="Browse packages"
                fullWidth={false}
                onPress={() => router.replace('/care-types')}
                style={{ marginTop: Spacing.md }}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="booking-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Confirm booking" subtitle={pkg.name} fallbackHref="/care-types" />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 140 }}>
        {/* -------------------------------------------------- patient ---- */}
        <Text style={styles.sec}>Who is this visit for?</Text>
        {patients.length === 0 ? (
          <TouchableOpacity
            style={styles.addRow}
            onPress={() => router.push('/patients')}
            testID="booking-add-patient"
          >
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.addTxt}>Add a patient</Text>
          </TouchableOpacity>
        ) : (
          <>
            {patients.map((p) => (
              <SelectRow
                key={p.id}
                title={p.full_name}
                subtitle={p.relationship_to_consumer}
                selected={p.id === effectivePatientId}
                onPress={() => setPatientId(p.id)}
                testID={`patient-${p.id}`}
              />
            ))}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/patients')}
              testID="booking-manage-patients"
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.linkTxt}>Add another patient</Text>
            </TouchableOpacity>
          </>
        )}

        {/* -------------------------------------------------- address ---- */}
        <Text style={styles.sec}>Service address</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity
            style={styles.addRow}
            onPress={() => router.push('/addresses')}
            testID="booking-add-address"
          >
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.addTxt}>Add an address</Text>
          </TouchableOpacity>
        ) : (
          <>
            {addresses.map((a) => (
              <SelectRow
                key={a.id}
                title={a.label}
                subtitle={formatAddress(a)}
                selected={a.id === effectiveAddressId}
                onPress={() => setAddressId(a.id)}
                testID={`address-${a.id}`}
              />
            ))}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/addresses')}
              testID="booking-manage-addresses"
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.linkTxt}>Add another address</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ----------------------------------------------------- date ---- */}
        <Text style={styles.sec}>Choose a date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {days.map((d, i) => (
            <TouchableOpacity
              key={d.ymd}
              style={[styles.day, dayIdx === i && styles.dayActive]}
              onPress={() => setDayIdx(i)}
              testID={`day-${i}`}
            >
              <Text style={[styles.dayLabel, dayIdx === i && { color: '#fff' }]}>{d.weekday}</Text>
              <Text style={[styles.dayNum, dayIdx === i && { color: '#fff' }]}>{d.day}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ----------------------------------------------------- slot ---- */}
        <Text style={styles.sec}>Preferred start time</Text>
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

        {/* --------------------------------------------------- urgent ---- */}
        <TouchableOpacity
          style={styles.urgentRow}
          onPress={() => setIsUrgent((v) => !v)}
          testID="booking-urgent"
        >
          <View style={[styles.checkbox, isUrgent && styles.checkboxOn]}>
            {isUrgent && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentTitle}>Mark as urgent</Text>
            <Text style={styles.urgentSub}>
              We’ll search a tighter radius first and escalate faster to find someone sooner.
            </Text>
          </View>
        </TouchableOpacity>

        {/* -------------------------------------------------- notes ------ */}
        <Text style={styles.sec}>Anything the nurse should know?</Text>
        <InputField
          placeholder="e.g. Patient is bedridden, has dementia, ring the bell twice…"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          testID="booking-notes"
        />

        {/* --------------------------------------------------- summary --- */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking summary</Text>
          <SummaryRow label="Care package" value={pkg.name} />
          <SummaryRow label="Patient" value={selectedPatient?.full_name ?? 'Not selected'} />
          <SummaryRow
            label="Address"
            value={selectedAddress ? formatAddress(selectedAddress) : 'Not selected'}
          />
          <SummaryRow
            label="When"
            value={`${days[dayIdx].weekday} ${days[dayIdx].day} · ${slot}`}
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>Total</Text>
            <Text style={styles.totalR}>{inr(price)}</Text>
          </View>
          <Text style={styles.priceNote}>
            This is the package price set by NurseConnect. You’ll confirm payment on the next
            screen — a nurse is only dispatched once payment succeeds.
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <GradientButton
          title={needsPrescriptionGate ? 'Continue' : 'Continue to payment'}
          onPress={startBooking}
          loading={submitting}
          testID="proceed-payment-btn"
        />
      </SafeAreaView>

      <PrescriptionSupplyGate
        visible={gateOpen}
        serviceOnly={isServiceOnly}
        submitting={submitting}
        onCancel={() => setGateOpen(false)}
        onComplete={submitGuarded}
      />
    </SafeAreaView>
  );
}

const SelectRow: React.FC<{
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ title, subtitle, selected, onPress, testID }) => (
  <TouchableOpacity
    style={[styles.selectRow, selected && styles.selectRowActive]}
    onPress={onPress}
    testID={testID}
  >
    <View style={[styles.radio, selected && styles.radioOn]}>
      {selected && <View style={styles.radioDot} />}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.selectTitle}>{title}</Text>
      {!!subtitle && (
        <Text style={styles.selectSub} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </View>
  </TouchableOpacity>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.sumRow}>
    <Text style={styles.sumL}>{label}</Text>
    <Text style={styles.sumR} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: 8 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    padding: 14,
  },
  addTxt: { ...Typography.body, color: Colors.primary, fontWeight: '600' as const },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  linkTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  selectRowActive: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  selectTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  selectSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
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
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginTop: Spacing.lg,
  },
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
  urgentTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  urgentSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.lg,
    ...Shadows.card,
  },
  summaryTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 },
  sumL: { ...Typography.body, color: Colors.textSecondary },
  sumR: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
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
  priceNote: { ...Typography.small, color: Colors.textTertiary, marginTop: 10, lineHeight: 17 },
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
