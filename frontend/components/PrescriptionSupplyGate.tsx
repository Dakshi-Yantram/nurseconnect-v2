import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { GradientButton } from './GradientButton';
import { PhotoCapture } from './PhotoCapture';
import {
  SupplyConfirmation,
  SUPPLY_CONFIRMATION_ITEMS,
} from '../services/composite-care.service';

export interface PrescriptionSupplyResult {
  prescriptionBase64: string;
  /** Both undefined for Workflow 1 (the platform brings the kit). */
  supplyConfirmation?: SupplyConfirmation;
  supplyPhotoBase64?: string;
}

interface Props {
  visible: boolean;
  /**
   * Workflow 2 when true — additionally collects the supply guardrail
   * (every item ticked + a photo of the supplies beside the prescription).
   * Workflow 1 only needs the prescription.
   */
  serviceOnly: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onComplete: (result: PrescriptionSupplyResult) => void;
}

const EMPTY_CONFIRMATION: Partial<SupplyConfirmation> = {};

/**
 * Step 1's gate for the two guarded workflows.
 *
 * Workflow 1 (Composite Care Package) needs the doctor's prescription.
 * Workflow 2 (Service-Only) additionally needs the supply guardrail: the
 * patient confirms they have every required item AND attaches a photo of
 * those supplies next to the prescription.
 *
 * Continue stays disabled until everything required is present, which is what
 * "the app blocks the payment step" means here — and the backend enforces the
 * same rules, so this is a convenience gate, not the security boundary.
 */
export const PrescriptionSupplyGate: React.FC<Props> = ({
  visible,
  serviceOnly,
  submitting,
  onCancel,
  onComplete,
}) => {
  const [prescriptionBase64, setPrescriptionBase64] = useState<string | null>(null);
  const [supplyPhotoBase64, setSupplyPhotoBase64] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<Partial<SupplyConfirmation>>(EMPTY_CONFIRMATION);

  const allConfirmed = useMemo(
    () => SUPPLY_CONFIRMATION_ITEMS.every((i) => confirmation[i.key] === true),
    [confirmation],
  );

  const ready = serviceOnly
    ? !!prescriptionBase64 && !!supplyPhotoBase64 && allConfirmed
    : !!prescriptionBase64;

  const submit = () => {
    if (!ready || !prescriptionBase64) return;
    onComplete({
      prescriptionBase64,
      supplyConfirmation: serviceOnly ? (confirmation as SupplyConfirmation) : undefined,
      supplyPhotoBase64: serviceOnly ? supplyPhotoBase64 ?? undefined : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <Text style={styles.title}>
              {serviceOnly ? 'Before you pay' : "Doctor's prescription"}
            </Text>
            <TouchableOpacity onPress={onCancel} testID="close-supply-gate">
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
            {serviceOnly && (
              <>
                <Text style={styles.sectionTitle}>Confirm you have everything ready</Text>
                <Text style={styles.sectionHint}>
                  Your nurse brings the clinical skill — you provide the materials. They&apos;ll
                  inspect and expiry-check everything before starting.
                </Text>
                <View style={styles.checkGroup}>
                  {SUPPLY_CONFIRMATION_ITEMS.map((item) => {
                    const checked = confirmation[item.key] === true;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={styles.checkRow}
                        onPress={() =>
                          setConfirmation((s) => ({ ...s, [item.key]: !checked }))
                        }
                        testID={`supply-confirm-${item.key}`}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={checked ? Colors.primary : Colors.textTertiary}
                        />
                        <Text style={styles.checkLabel}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Doctor&apos;s prescription</Text>
            <PhotoCapture
              title={prescriptionBase64 ? 'Prescription attached' : "Attach the doctor's prescription"}
              hint="A clear photo of the full prescription"
              allowGallery
              submitted={!!prescriptionBase64}
              onCaptured={(base64) => setPrescriptionBase64(base64)}
              testID="capture-prescription"
            />

            {serviceOnly && (
              <>
                <Text style={styles.sectionTitle}>Photo of your supplies</Text>
                <PhotoCapture
                  title={supplyPhotoBase64 ? 'Supply photo attached' : 'Attach a photo of your supplies'}
                  hint="Lay your supplies next to the prescription so both are visible"
                  allowGallery
                  submitted={!!supplyPhotoBase64}
                  onCaptured={(base64) => setSupplyPhotoBase64(base64)}
                  testID="capture-supply-photo"
                />
              </>
            )}

            <GradientButton
              title={submitting ? 'Creating booking…' : 'Continue to payment'}
              onPress={submit}
              loading={submitting}
              disabled={!ready || submitting}
              style={{ marginTop: Spacing.lg }}
              testID="supply-gate-continue"
            />
            {!ready && (
              <Text style={styles.blockedHint}>
                {serviceOnly
                  ? 'Tick every item and attach both photos to continue.'
                  : 'Attach the prescription to continue.'}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '90%',
    ...Shadows.card,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h3, color: Colors.textPrimary },
  sectionTitle: {
    ...Typography.bodyBold,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  sectionHint: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  checkGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkLabel: { ...Typography.small, color: Colors.textPrimary, flex: 1 },
  blockedHint: {
    ...Typography.small,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
