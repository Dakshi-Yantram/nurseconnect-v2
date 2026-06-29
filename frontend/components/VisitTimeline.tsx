import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export interface TimelineStep {
  key: string;
  label: string;
  time?: string;
  done: boolean;
  active?: boolean;
}

interface Props {
  steps: TimelineStep[];
}

export const VisitTimeline: React.FC<Props> = ({ steps }) => (
  <View style={styles.wrap} testID="visit-timeline">
    {steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      const colorDone = s.done ? Colors.success : s.active ? Colors.primary : Colors.border;
      return (
        <View key={s.key} style={styles.row}>
          <View style={styles.lineCol}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: s.done
                    ? Colors.success
                    : s.active
                    ? Colors.primary
                    : Colors.surface,
                  borderColor: colorDone,
                },
              ]}
            >
              {s.done && <Ionicons name="checkmark" size={11} color="#fff" />}
            </View>
            {!isLast && (
              <View
                style={[styles.line, { backgroundColor: s.done ? Colors.success : Colors.border }]}
              />
            )}
          </View>
          <View style={styles.content}>
            <Text
              style={[
                styles.label,
                s.active ? { color: Colors.primary, fontWeight: '700' } : null,
                !s.done && !s.active ? { color: Colors.textTertiary } : null,
              ]}
            >
              {s.label}
            </Text>
            {s.time && <Text style={styles.time}>{s.time}</Text>}
          </View>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: { paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', minHeight: 56 },
  lineCol: { width: 24, alignItems: 'center' },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  line: { flex: 1, width: 2, marginVertical: 2 },
  content: { flex: 1, marginLeft: 12, paddingBottom: Spacing.md },
  label: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' as const },
  time: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
