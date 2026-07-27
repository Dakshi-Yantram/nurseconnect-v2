/**
 * Clinical training lead: review queue.
 *
 * Modules and assessments submitted by trainers, waiting on approval.
 * Approving publishes immediately — that's the backend's behaviour for both
 * content types — so the confirmation says so rather than implying a separate
 * publish step.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { EmptyState } from '../../components/EmptyState';
import { ContentStatusChip } from '../../components/ContentStatusChip';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import {
  trainingService,
  type AssessmentOut,
  type TrainingModuleAdmin,
} from '../../services/training.service';
import { formatDuration } from '../../lib/format';

type Kind = 'module' | 'assessment';

interface QueueItem {
  kind: Kind;
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string | null;
  questionCount: number;
  passMark: number;
  durationMinutes?: number;
  questions: Record<string, any>[];
}

export default function LeadReview() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const [active, setActive] = useState<QueueItem | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [mods, assess] = await Promise.allSettled([
      trainingService.listModulesAdmin(),
      trainingService.listAssessmentsAdmin(),
    ]);

    const rows: QueueItem[] = [];
    if (mods.status === 'fulfilled') {
      rows.push(
        ...mods.value.map((m: TrainingModuleAdmin) => ({
          kind: 'module' as const,
          id: m.id,
          code: m.code,
          title: m.title,
          description: m.description,
          status: m.status,
          questionCount: (m.assessment ?? []).length,
          passMark: m.pass_percent,
          durationMinutes: m.duration_minutes,
          questions: m.assessment ?? [],
        })),
      );
    }
    if (assess.status === 'fulfilled') {
      rows.push(
        ...assess.value.map((a: AssessmentOut) => ({
          kind: 'assessment' as const,
          id: a.id,
          code: a.code,
          title: a.title,
          description: a.description,
          status: a.status,
          questionCount: (a.questions ?? []).length,
          passMark: a.pass_score,
          questions: (a.questions ?? []) as Record<string, any>[],
        })),
      );
    }
    if (mods.status === 'rejected' && assess.status === 'rejected') {
      setError('Could not load the review queue.');
    }
    setItems(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(
    () => (filter === 'pending' ? items.filter((i) => i.status === 'under_review') : items),
    [items, filter],
  );
  const pendingCount = items.filter((i) => i.status === 'under_review').length;

  const act = async (action: 'approve' | 'reject') => {
    if (!active) return;
    if (action === 'reject' && notes.trim().length < 5) {
      Alert.alert(
        'Add a reason',
        'Tell the trainer what needs changing — they’ll see this note on the module.',
      );
      return;
    }
    setActing(true);
    try {
      const trimmed = notes.trim() || undefined;
      if (active.kind === 'module') {
        if (action === 'approve') await trainingService.approveModule(active.id, trimmed);
        else await trainingService.rejectModule(active.id, trimmed);
      } else {
        if (action === 'approve') await trainingService.approveAssessment(active.id, trimmed);
        else await trainingService.rejectAssessment(active.id, trimmed);
      }
      setActive(null);
      setNotes('');
      await load();
      Alert.alert(
        action === 'approve' ? 'Approved and published' : 'Sent back',
        action === 'approve'
          ? 'Nurses can see this now.'
          : 'The trainer can revise and resubmit it.',
      );
    } catch (e: any) {
      Alert.alert('Could not complete', e?.message || 'Please try again.');
    } finally {
      setActing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="lead-review">
      <Header title="Training review" showBack={false} />

      <View style={styles.tabs}>
        {(['pending', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
            testID={`filter-${f}`}
          >
            <Text style={[styles.tabTxt, filter === f && styles.tabTxtActive]}>
              {f === 'pending' ? 'Awaiting review' : 'All content'}
            </Text>
            {f === 'pending' && pendingCount > 0 && (
              <View style={styles.count}>
                <Text style={styles.countTxt}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'Nothing awaiting review' : 'No training content yet'}
          description={
            filter === 'pending'
              ? 'When a trainer submits a module or assessment, it lands here for your approval.'
              : 'Modules and assessments authored by your team will appear here.'
          }
          icon="clipboard-outline"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          {visible.map((item) => (
            <TouchableOpacity
              key={`${item.kind}-${item.id}`}
              style={styles.card}
              onPress={() => {
                setActive(item);
                setNotes('');
              }}
              testID={`review-${item.id}`}
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.code}>
                    {item.kind === 'module' ? 'Training module' : 'Assessment'} · {item.code}
                  </Text>
                </View>
                <ContentStatusChip status={item.status as any} />
              </View>

              <View style={styles.metaRow}>
                <Meta icon="help-circle-outline" text={`${item.questionCount} questions`} />
                <Meta icon="ribbon-outline" text={`Pass ${item.passMark}%`} />
                {!!item.durationMinutes && (
                  <Meta icon="time-outline" text={formatDuration(item.durationMinutes)} />
                )}
              </View>

              {item.status === 'under_review' && (
                <View style={styles.reviewCta}>
                  <Text style={styles.reviewCtaTxt}>Tap to review</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ------------------------------------------------- review modal --- */}
      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header
            title="Review"
            showBack={false}
            rightIcon="close"
            onRightPress={() => setActive(null)}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {!!active && (
                <>
                  <Text style={styles.modalTitle}>{active.title}</Text>
                  <Text style={styles.code}>
                    {active.kind === 'module' ? 'Training module' : 'Assessment'} · {active.code}
                  </Text>
                  {!!active.description && (
                    <Text style={styles.modalDesc}>{active.description}</Text>
                  )}

                  <Text style={styles.sectionTitle}>
                    Questions ({active.questions.length})
                  </Text>
                  {active.questions.length === 0 ? (
                    <Text style={styles.noQuestions}>
                      This has no questions — worth sending back unless it’s purely reading
                      material.
                    </Text>
                  ) : (
                    active.questions.map((q, qi) => {
                      const options: string[] = q.options ?? [];
                      const correct = q.correct_index;
                      return (
                        <View key={qi} style={styles.qCard}>
                          <Text style={styles.qTxt}>
                            {qi + 1}. {q.question ?? q.text}
                          </Text>
                          {options.map((opt, oi) => (
                            <View key={oi} style={styles.optRow}>
                              <Ionicons
                                name={oi === correct ? 'checkmark-circle' : 'ellipse-outline'}
                                size={15}
                                color={oi === correct ? Colors.success : Colors.textTertiary}
                              />
                              <Text
                                style={[
                                  styles.optTxt,
                                  oi === correct && { color: Colors.success, fontWeight: '600' },
                                ]}
                              >
                                {opt}
                              </Text>
                            </View>
                          ))}
                          {!!q.explanation && (
                            <Text style={styles.explanation}>{q.explanation}</Text>
                          )}
                        </View>
                      );
                    })
                  )}

                  <InputField
                    label="Notes for the trainer"
                    placeholder="Required when sending back for changes"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                    testID="review-notes"
                  />

                  {active.status === 'under_review' ? (
                    <>
                      <GradientButton
                        title="Approve & publish"
                        onPress={() => act('approve')}
                        loading={acting}
                        testID="review-approve"
                      />
                      <GradientButton
                        title="Send back for changes"
                        variant="outline"
                        onPress={() => act('reject')}
                        loading={acting}
                        style={{ marginTop: Spacing.sm }}
                        testID="review-reject"
                      />
                    </>
                  ) : (
                    <View style={styles.noteCard}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.noteTxt}>
                        This isn’t awaiting review, so there’s nothing to approve right now.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Meta: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.meta}>
    <Ionicons name={icon} size={13} color={Colors.textSecondary} />
    <Text style={styles.metaTxt}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginVertical: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
  },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  tabTxtActive: { color: Colors.primary },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countTxt: { ...Typography.caption, fontSize: 10, color: '#fff', fontWeight: '700' as const },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  code: { ...Typography.caption, color: Colors.textTertiary, marginTop: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' as const },
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  reviewCtaTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const, flex: 1 },
  modalTitle: { ...Typography.h2, color: Colors.textPrimary },
  modalDesc: { ...Typography.body, color: Colors.textSecondary, marginTop: 10, lineHeight: 21 },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  noQuestions: { ...Typography.small, color: Colors.warning, lineHeight: 18 },
  qCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  qTxt: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 10, lineHeight: 21 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  optTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
  explanation: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  noteCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
  },
  noteTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
});
