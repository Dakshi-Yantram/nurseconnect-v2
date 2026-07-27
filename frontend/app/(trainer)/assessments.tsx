/**
 * Trainer: standalone assessment authoring.
 *
 * These are the gated tests that unlock care packages, so anti-cheat settings
 * (question pool sampling, time limit, attempt cap, cooldown) are configured
 * here alongside the questions themselves.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { EmptyState } from '../../components/EmptyState';
import { ContentStatusChip } from '../../components/ContentStatusChip';
import { QuestionEditor } from '../../components/QuestionEditor';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import {
  trainingService,
  type AssessmentOut,
  type AssessmentQuestion,
} from '../../services/training.service';
import { formatDuration } from '../../lib/format';

interface Draft {
  code: string;
  title: string;
  description: string;
  pass_score: string;
  questions: AssessmentQuestion[];
}

const EMPTY: Draft = {
  code: '',
  title: '',
  description: '',
  pass_score: '70',
  questions: [],
};

export default function TrainerAssessments() {
  const [assessments, setAssessments] = useState<AssessmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentOut | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setAssessments(await trainingService.listAssessmentsAdmin());
    } catch (e: any) {
      setError(e?.message || 'Could not load assessments');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNew = () => {
    setEditing(null);
    setDraft(EMPTY);
    setEditorOpen(true);
  };

  const openEdit = (a: AssessmentOut) => {
    setEditing(a);
    setDraft({
      code: a.code,
      title: a.title,
      description: a.description ?? '',
      pass_score: String(a.pass_score ?? 70),
      questions: a.questions ?? [],
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) return Alert.alert('Title needed', 'Give this assessment a title.');
    if (!editing && !draft.code.trim()) {
      return Alert.alert('Code needed', 'A short unique code identifies it, e.g. WOUND-ASSESS.');
    }
    if (draft.questions.length === 0) {
      return Alert.alert('Add a question', 'An assessment needs at least one question.');
    }
    const incomplete = draft.questions.find(
      (q) => !q.question?.trim() || (q.options ?? []).some((o) => !o.trim()),
    );
    if (incomplete) {
      return Alert.alert(
        'Finish your questions',
        'Every question needs text and no empty answer options.',
      );
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        pass_score: Number(draft.pass_score) || 70,
        questions: draft.questions,
      };
      if (editing) {
        await trainingService.updateAssessmentDraft(editing.id, payload);
      } else {
        await trainingService.createAssessmentDraft({ ...payload, code: draft.code.trim() });
      }
      await load();
      setEditorOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = (a: AssessmentOut) => {
    Alert.alert(
      'Submit for review?',
      'A clinical training lead will review this before nurses can attempt it.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await trainingService.submitAssessmentForReview(a.id);
              await load();
            } catch (e: any) {
              Alert.alert('Could not submit', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const editable = (a: AssessmentOut) => a.status === 'draft' || a.status === 'rejected';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="trainer-assessments">
      <Header title="Assessments" showBack={false} rightIcon="add" onRightPress={openNew} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} />
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
      ) : assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Author an assessment to gate a care package behind a test nurses must pass."
          icon="clipboard-outline"
          ctaTitle="Create an assessment"
          onCtaPress={openNew}
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
          {assessments.map((a) => (
            <View key={a.id} style={styles.card} testID={`assessment-${a.id}`}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.title}>{a.title}</Text>
                  <Text style={styles.code}>{a.code}</Text>
                </View>
                <ContentStatusChip status={a.status} />
              </View>

              <View style={styles.metaRow}>
                <Meta icon="help-circle-outline" text={`${(a.questions ?? []).length} questions`} />
                <Meta icon="ribbon-outline" text={`Pass ${a.pass_score}%`} />
                {!!a.time_limit_minutes && (
                  <Meta icon="time-outline" text={formatDuration(a.time_limit_minutes)} />
                )}
                {!!a.max_attempts && (
                  <Meta icon="repeat-outline" text={`Max ${a.max_attempts} attempts`} />
                )}
              </View>

              {!!a.review_notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Reviewer’s note</Text>
                  <Text style={styles.notesTxt}>{a.review_notes}</Text>
                </View>
              )}

              <View style={styles.actions}>
                {editable(a) ? (
                  <>
                    <TouchableOpacity style={styles.action} onPress={() => openEdit(a)}>
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={styles.actionTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.action} onPress={() => submitForReview(a)}>
                      <Ionicons name="send-outline" size={16} color={Colors.accent} />
                      <Text style={[styles.actionTxt, { color: Colors.accent }]}>
                        Submit for review
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.lockedTxt}>
                    {a.status === 'under_review'
                      ? 'Locked while a training lead reviews it.'
                      : 'Published — nurses can attempt this now.'}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ------------------------------------------------------ editor ---- */}
      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Header
            title={editing ? 'Edit assessment' : 'New assessment'}
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
              {!editing && (
                <InputField
                  label="Assessment code"
                  placeholder="WOUND-ASSESS"
                  autoCapitalize="characters"
                  value={draft.code}
                  onChangeText={(v) => setDraft((d) => ({ ...d, code: v }))}
                  testID="assessment-code"
                />
              )}
              <InputField
                label="Title"
                placeholder="Wound care competency"
                value={draft.title}
                onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
                testID="assessment-title"
              />
              <InputField
                label="Description"
                placeholder="What this assessment covers"
                value={draft.description}
                onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <InputField
                label="Pass mark (%)"
                keyboardType="number-pad"
                value={draft.pass_score}
                onChangeText={(v) => setDraft((d) => ({ ...d, pass_score: v }))}
              />

              <View style={styles.noteCard}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
                <Text style={styles.noteTxt}>
                  Anti-cheat settings — question sampling, time limit, attempt cap and cooldown —
                  are configured by an admin on the web portal once this is published.
                </Text>
              </View>

              <QuestionEditor
                questions={draft.questions}
                onChange={(questions) => setDraft((d) => ({ ...d, questions }))}
              />

              <GradientButton
                title={editing ? 'Save changes' : 'Create draft'}
                onPress={save}
                loading={saving}
                style={{ marginTop: Spacing.md }}
                testID="assessment-save"
              />
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
  notesBox: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  notesLabel: { ...Typography.caption, color: Colors.warning, fontWeight: '700' as const },
  notesTxt: { ...Typography.small, color: Colors.warning, marginTop: 3, lineHeight: 17 },
  actions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionTxt: { ...Typography.small, color: Colors.primary, fontWeight: '600' as const },
  lockedTxt: { ...Typography.small, color: Colors.textTertiary, flex: 1, lineHeight: 17 },
  noteCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: 12,
  },
  noteTxt: { ...Typography.small, color: Colors.primary, flex: 1, lineHeight: 17 },
});
