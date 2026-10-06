/**
 * Materials checklist — the items the nurse brings for a care package, each
 * with its photo and a checkbox. Shown twice in the patient flow: on the
 * booking screen and again on the payment screen. Same card/checkbox styling
 * as the rest of booking.tsx (Colors / Radius / Shadows from theme).
 *
 * `readOnly` is the nurse-side view (no checkboxes, just what to carry).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { resolveMediaUrl } from '../lib/api';
import type { PackageMaterial } from '../services/package-materials.service';

interface Props {
  materials: PackageMaterial[];
  checked?: Record<string, boolean>;
  onChange?: (next: Record<string, boolean>) => void;
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
  testID?: string;
}

export const allMaterialsChecked = (
  materials: PackageMaterial[],
  checked: Record<string, boolean>,
) => materials.length > 0 && materials.every((m) => checked[m.id] === true);

export const MaterialsChecklist: React.FC<Props> = ({
  materials,
  checked = {},
  onChange,
  title = 'Materials the nurse will bring',
  subtitle,
  readOnly = false,
  testID = 'materials-checklist',
}) => {
  if (!materials.length) return null;
  const done = materials.filter((m) => checked[m.id]).length;
  const all = done === materials.length;

  const toggle = (id: string) => onChange?.({ ...checked, [id]: !checked[id] });
  const toggleAll = () =>
    onChange?.(Object.fromEntries(materials.map((m) => [m.id, !all])));

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="bandage-outline" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{title}</Text>
          {!readOnly && (
            <Text style={styles.count}>
              {done}/{materials.length} confirmed
            </Text>
          )}
        </View>
        {!readOnly && (
          <TouchableOpacity onPress={toggleAll} testID={`${testID}-all`} style={styles.allBtn}>
            <Text style={styles.allTxt}>{all ? 'Clear' : 'Select all'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}

      {materials.map((m) => {
        const on = !!checked[m.id];
        const uri = resolveMediaUrl(m.image_url);
        const Row: any = readOnly ? View : TouchableOpacity;
        return (
          <Row
            key={m.id}
            style={[styles.row, !readOnly && on && styles.rowOn]}
            onPress={readOnly ? undefined : () => toggle(m.id)}
            activeOpacity={0.8}
            testID={`${testID}-item-${m.id}`}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.img} resizeMode="cover" />
            ) : (
              <View style={[styles.img, styles.imgEmpty]}>
                <Ionicons name="image-outline" size={20} color={Colors.textTertiary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.qty}>
                Qty {m.quantity}
                {m.unit ? ` ${m.unit}` : ''}
              </Text>
              {!!m.notes && !/^SAMPLE/i.test(m.notes) && (
                <Text style={styles.notes}>{m.notes}</Text>
              )}
            </View>
            {!readOnly && (
              <View style={[styles.checkbox, on && styles.checkboxOn]}>
                {on && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            )}
          </Row>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginTop: Spacing.lg,
    ...Shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h4, color: Colors.textPrimary },
  count: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' as const },
  allBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  allTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 10, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 10,
    marginTop: 10,
  },
  rowOn: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  img: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt },
  imgEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { ...Typography.bodyBold, color: Colors.textPrimary, fontSize: 15 },
  qty: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  notes: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
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
});
