import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '../constants/theme';
import type { ContentStatus } from '../services/training.service';

const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: Colors.surfaceAlt, fg: Colors.textSecondary, label: 'Draft' },
  under_review: { bg: Colors.warningBg, fg: Colors.warning, label: 'Under review' },
  approved: { bg: Colors.infoBg, fg: Colors.primary, label: 'Approved' },
  rejected: { bg: Colors.errorBg, fg: Colors.danger, label: 'Changes needed' },
  published: { bg: Colors.successBg, fg: Colors.success, label: 'Published' },
};

/** Status chip for authored training content (modules and assessments). */
export const ContentStatusChip: React.FC<{ status: ContentStatus | null; testID?: string }> = ({
  status,
  testID,
}) => {
  const tone = TONE[status ?? 'draft'] ?? TONE.draft;
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]} testID={testID}>
      <Text style={[styles.txt, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  txt: { ...Typography.caption, fontWeight: '700' as const },
});
