import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import {
  SAFETY_CHECKLIST_ITEMS,
  SafetyChecklistAnswers,
  SafetyChecklistItem,
  SafetyChecklistKey,
} from '../services/composite-care.service';

interface Props {
  title: string;
  subtitle?: string;
  /** Current yes/no answers — undefined items render unanswered. */
  values: Partial<SafetyChecklistAnswers>;
  /** Omit (or set readOnly) to render a static, non-interactive summary. */
  onChange?: (key: SafetyChecklistKey, value: boolean) => void;
  readOnly?: boolean;
  /** Highlights items that mismatch a counterpart's answers (anti-cheat). */
  mismatchedKeys?: string[];
  /**
   * The five items to render. Defaults to Workflow 1's questionnaire;
   * Workflow 2 (service-only) passes its supply-inspection items instead.
   */
  items?: SafetyChecklistItem[];
}

export const SafetyChecklistCard: React.FC<Props> = ({
  title,
  subtitle,
  values,
  onChange,
  readOnly,
  mismatchedKeys,
  items = SAFETY_CHECKLIST_ITEMS,
}) => {
  return (
    <View style={styles.card} testID="safety-checklist-card">
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={{ marginTop: Spacing.md }}>
        {items.map((item) => {
          const answer = values[item.key];
          const mismatched = mismatchedKeys?.includes(item.key);
          return (
            <View
              key={item.key}
              style={[styles.row, mismatched && styles.rowMismatch]}
              testID={`safety-item-${item.key}`}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <View style={styles.answerWrap}>
                <YesNoButton
                  label="Yes"
                  active={answer === true}
                  disabled={readOnly}
                  color={Colors.success}
                  onPress={() => onChange?.(item.key, true)}
                />
                <YesNoButton
                  label="No"
                  active={answer === false}
                  disabled={readOnly}
                  color={Colors.error}
                  onPress={() => onChange?.(item.key, false)}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const YesNoButton: React.FC<{
  label: string;
  active: boolean;
  disabled?: boolean;
  color: string;
  onPress: () => void;
}> = ({ label, active, disabled, color, onPress }) => (
  <TouchableOpacity
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.pill,
      active && { backgroundColor: color + '18', borderColor: color },
      disabled && !active && styles.pillDisabled,
    ]}
    testID={`safety-answer-${label.toLowerCase()}`}
  >
    {active && <Ionicons name="checkmark" size={13} color={color} style={{ marginRight: 3 }} />}
    <Text style={[styles.pillTxt, active && { color, fontWeight: '700' as const }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    ...Shadows.card,
  },
  title: { ...Typography.h4, color: Colors.textPrimary },
  subtitle: { ...Typography.small, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowMismatch: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  rowLabel: { ...Typography.small, color: Colors.textPrimary, flex: 1, marginRight: 8, lineHeight: 18 },
  answerWrap: { flexDirection: 'row', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pillDisabled: { opacity: 0.5 },
  pillTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' as const },
});
