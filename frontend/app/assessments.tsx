/**
 * Assessments available to this care professional.
 *
 * Passing an assessment is what unlocks a qualification gate, so the list
 * shows the attempt/cooldown state the backend enforces (`can_start` and
 * `locked_reason`) rather than letting a nurse tap into a 403.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { formatDuration, relativeTime } from '../lib/format';
import type { AssessmentOut } from '../services/training.service';

export default function Assessments() {
  const router = useRouter();
  const assessments = useStore((s) => s.assessments);
  const state = useStore((s) => s.loadState.assessments);
  const loadAssessmentsAPI = useStore((s) => s.loadAssessmentsAPI);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAssessmentsAPI().catch(() => {});
    }, [loadAssessmentsAPI]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAssessmentsAPI().catch(() => {});
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="assessments-screen">
      <OfflineBanner />
      <Header title="Assessments" fallbackHref="/(nurse)/dashboard" />

      <AsyncBoundary
        state={state}
        isEmpty={assessments.length === 0}
        emptyTitle="No assessments available"
        emptyDescription="Assessments appear here once your training team publishes them."
        emptyIcon="clipboard-outline"
        onRetry={() => loadAssessmentsAPI()}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.intro}>
            Passing an assessment unlocks the care packages that require it.
          </Text>
          {assessments.map((a) => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              onStart={() =>
                router.push({ pathname: '/assessment/[id]', params: { id: a.id } })
              }
            />
          ))}
        </ScrollView>
      </AsyncBoundary>
    </SafeAreaView>
  );
}

const AssessmentCard: React.FC<{ assessment: AssessmentOut; onStart: () => void }> = ({
  assessment: a,
  onStart,
}) => {
  const passed = a.latest_passed === true;
  const attempted = !!a.attempted;
  const canStart = a.can_start !== false;

  return (
    <View style={styles.card} testID={`assessment-${a.id}`}>
      <View style={styles.head}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.title}>{a.title}</Text>
          {!!a.description && (
            <Text style={styles.desc} numberOfLines={2}>
              {a.description}
            </Text>
          )}
        </View>
        {attempted && (
          <View
            style={[
              styles.badge,
              { backgroundColor: passed ? Colors.successBg : Colors.errorBg },
            ]}
          >
            <Text style={[styles.badgeTxt, { color: passed ? Colors.success : Colors.danger }]}>
              {passed ? 'Passed' : 'Not passed'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <Meta icon="help-circle-outline" text={`${a.questions_per_attempt} questions`} />
        <Meta icon="ribbon-outline" text={`Pass ${a.pass_score}%`} />
        {!!a.time_limit_minutes && (
          <Meta icon="time-outline" text={formatDuration(a.time_limit_minutes)} />
        )}
        {!!a.max_attempts && (
          <Meta
            icon="repeat-outline"
            text={`${a.attempts_used ?? 0}/${a.max_attempts} attempts`}
          />
        )}
      </View>

      {attempted && a.latest_score != null && (
        <Text style={styles.lastAttempt}>
          Last attempt: {a.latest_score}%
          {a.latest_submitted_at ? ` · ${relativeTime(a.latest_submitted_at)}` : ''}
        </Text>
      )}

      {canStart ? (
        <TouchableOpacity style={styles.startBtn} onPress={onStart} testID={`start-${a.id}`}>
          <Text style={styles.startTxt}>
            {passed ? 'Retake' : attempted ? 'Try again' : 'Start assessment'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.lockedRow}>
          <Ionicons name="lock-closed" size={15} color={Colors.textSecondary} />
          <Text style={styles.lockedTxt}>{a.locked_reason || 'Not available right now.'}</Text>
        </View>
      )}
    </View>
  );
};

const Meta: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.meta}>
    <Ionicons name={icon} size={13} color={Colors.textSecondary} />
    <Text style={styles.metaTxt}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  desc: { ...Typography.small, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, fontWeight: '700' as const },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' as const },
  lastAttempt: { ...Typography.caption, color: Colors.textTertiary, marginTop: 10 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.teal,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    marginTop: Spacing.md,
  },
  startTxt: { ...Typography.bodyBold, color: '#fff' },
  lockedRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  lockedTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});
