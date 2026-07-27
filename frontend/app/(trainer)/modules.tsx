/**
 * Trainer: training module authoring.
 *
 * Lifecycle is draft → under review → published. A trainer authors and
 * submits; only a clinical training lead can approve or publish, so this
 * screen never offers those actions to a trainer.
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
  type AssessmentQuestion,
  type TrainingModuleAdmin,
} from '../../services/training.service';
import { formatDuration } from '../../lib/format';

interface Draft {
  code: string;
  title: string;
  description: string;
  category: string;
  duration_minutes: string;
  pass_percent: string;
  is_mandatory: boolean;
  assessment: AssessmentQuestion[];
}

const EMPTY: Draft = {
  code: '',
  title: '',
  description: '',
  category: '',
  duration_minutes: '30',
  pass_percent: '70',
  is_mandatory: false,
  assessment: [],
};

export default function TrainerModules() {
  const [modules, setModules] = useState<TrainingModuleAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingModuleAdmin | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setModules(await trainingService.listModulesAdmin());
    } catch (e: any) {
      setError(e?.message || 'Could not load your modules');
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

  const openEdit = (m: TrainingModuleAdmin) => {
    setEditing(m);
    setDraft({
      code: m.code,
      title: m.title,
      description: m.description ?? '',
      category: m.category ?? '',
      duration_minutes: String(m.duration_minutes ?? 0),
      pass_percent: String(m.pass_percent ?? 70),
      is_mandatory: !!m.is_mandatory,
      assessment: (m.assessment ?? []) as AssessmentQuestion[],
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) return Alert.alert('Title needed', 'Give this module a title.');
    if (!editing && !draft.code.trim()) {
      return Alert.alert('Code needed', 'A short unique code identifies this module, e.g. WOUND-101.');
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        category: draft.category.trim() || undefined,
        duration_minutes: Number(draft.duration_minutes) || 0,
        pass_percent: Number(draft.pass_percent) || 70,
        is_mandatory: draft.is_mandatory,
        assessment: draft.assessment,
      };
      if (editing) {
        await trainingService.updateModuleDraft(editing.id, payload);
      } else {
        await trainingService.createModuleDraft({ ...payload, code: draft.code.trim() });
      }
      await load();
      setEditorOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = (m: TrainingModuleAdmin) => {
    Alert.alert(
      'Submit for review?',
      'A clinical training lead will review this module before it reaches nurses. You won’t be able to edit it while it’s under review.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await trainingService.submitModuleForReview(m.id);
              await load();
            } catch (e: any) {
              Alert.alert('Could not submit', e?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const editable = (m: TrainingModuleAdmin) =>
    m.status === 'draft' || m.status === 'rejected';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="trainer-modules">
      <Header
        title="Training modules"
        showBack={false}
        rightIcon="add"
        onRightPress={openNew}
      />

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
      ) : modules.length === 0 ? (
        <EmptyState
          title="No modules yet"
          description="Author a training module, then submit it for review. Once published, nurses can work through it and take its quiz."
          icon="book-outline"
          ctaTitle="Create a module"
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
          {modules.map((m) => (
            <View key={m.id} style={styles.card} testID={`module-${m.id}`}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.title}>{m.title}</Text>
                  <Text style={styles.code}>{m.code}</Text>
                </View>
                <ContentStatusChip status={m.status} />
              </View>

              <View style={styles.metaRow}>
                <Meta icon="time-outline" text={formatDuration(m.duration_minutes)} />
                <Meta icon="ribbon-outline" text={`Pass ${m.pass_percent}%`} />
                <Meta
                  icon="help-circle-outline"
                  text={`${(m.assessment ?? []).length} questions`}
                />
                {m.is_mandatory && <Meta icon="alert-circle-outline" text="Mandatory" />}
              </View>

              {!!m.review_notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Reviewer’s note</Text>
                  <Text style={styles.notesTxt}>{m.review_notes}</Text>
                </View>
              )}

              <View style={styles.actions}>
                {editable(m) ? (
                  <>
                    <TouchableOpacity style={styles.action} onPress={() => openEdit(m)}>
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={styles.actionTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.action}
                      onPress={() => submitForReview(m)}
                      testID={`submit-${m.id}`}
                    >
                      <Ionicons name="send-outline" size={16} color={Colors.accent} />
                      <Text style={[styles.actionTxt, { color: Colors.accent }]}>
                        Submit for review
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.lockedTxt}>
                    {m.status === 'under_review'
                      ? 'Locked while a training lead reviews it.'
                      : 'Published — create a new version to make changes.'}
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
            title={editing ? 'Edit module' : 'New module'}
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
                  label="Module code"
                  placeholder="WOUND-101"
                  autoCapitalize="characters"
                  value={draft.code}
                  onChangeText={(v) => setDraft((d) => ({ ...d, code: v }))}
                  testID="module-code"
                />
              )}
              <InputField
                label="Title"
                placeholder="Wound assessment and dressing"
                value={draft.title}
                onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
                testID="module-title"
              />
              <InputField
                label="Category"
                placeholder="Clinical skills"
                value={draft.category}
                onChangeText={(v) => setDraft((d) => ({ ...d, category: v }))}
              />
              <InputField
                label="Description"
                placeholder="What a nurse will be able to do after this module"
                value={draft.description}
                onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Duration (minutes)"
                    keyboardType="number-pad"
                    value={draft.duration_minutes}
                    onChangeText={(v) => setDraft((d) => ({ ...d, duration_minutes: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Pass mark (%)"
                    keyboardType="number-pad"
                    value={draft.pass_percent}
                    onChangeText={(v) => setDraft((d) => ({ ...d, pass_percent: v }))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setDraft((d) => ({ ...d, is_mandatory: !d.is_mandatory }))}
              >
                <View style={[styles.checkbox, draft.is_mandatory && styles.checkboxOn]}>
                  {draft.is_mandatory && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.checkTxt}>Mandatory for all nurses</Text>
              </TouchableOpacity>

              <QuestionEditor
                questions={draft.assessment}
                onChange={(assessment) => setDraft((d) => ({ ...d, assessment }))}
              />

              <GradientButton
                title={editing ? 'Save changes' : 'Create draft'}
                onPress={save}
                loading={saving}
                style={{ marginTop: Spacing.md }}
                testID="module-save"
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkTxt: { ...Typography.body, color: Colors.textPrimary },
});
