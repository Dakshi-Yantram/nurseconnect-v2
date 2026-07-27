/**
 * Training module detail + its quiz.
 *
 * Everything is read from `/training/modules/{id}`. The previous version
 * invented module names ("Introduction", "Core concepts", …) and a progress
 * bar from a `modules` count that no backend field corresponds to, so the
 * screen showed a curriculum that didn't exist.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import {
  trainingService,
  type AssessmentSubmitResult,
  type TrainingModuleDetail,
} from '../../services/training.service';
import { formatDuration } from '../../lib/format';

export default function ModuleDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadTrainingAPI = useStore((s) => s.loadTrainingAPI);

  const [module, setModule] = useState<TrainingModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentSubmitResult | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      setModule(await trainingService.get(id));
    } catch (e: any) {
      setError(e?.message || 'Could not load this module');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const questions = module?.assessment ?? [];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const submitQuiz = async () => {
    if (!module || !allAnswered) return;
    setSubmitting(true);
    try {
      // The module quiz endpoint takes a bare array, in question order.
      const payload = questions.map((q) => ({ id: q.id, answer: answers[q.id] }));
      const res = await trainingService.submitModuleAssessment(module.id, payload);
      setResult(res);
      // Refresh the list so the completed badge is right when we go back.
      loadTrainingAPI().catch(() => {});
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const retake = () => {
    setResult(null);
    setAnswers({});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Training" fallbackHref="/training" />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!module) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Training" fallbackHref="/training" />
        <View style={styles.centered}>
          <Ionicons name="school-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error || 'This module could not be found.'}</Text>
          <GradientButton
            title="Try again"
            variant="outline"
            fullWidth={false}
            onPress={load}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="module-detail" edges={['top']}>
      <OfflineBanner />
      <Header title={module.title} fallbackHref="/training" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        <View style={styles.card}>
          <Text style={styles.title}>{module.title}</Text>
          <View style={styles.metaRow}>
            <Meta icon="time-outline" text={formatDuration(module.duration_minutes)} />
            <Meta icon="ribbon-outline" text={`Pass mark ${module.pass_percent}%`} />
            {questions.length > 0 && (
              <Meta icon="help-circle-outline" text={`${questions.length} questions`} />
            )}
          </View>
          {!!module.description && <Text style={styles.desc}>{module.description}</Text>}
        </View>

        {(!!module.video_url || !!module.content_url) && (
          <View style={styles.card}>
            <Text style={styles.secTitle}>Learning material</Text>
            {!!module.video_url && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => Linking.openURL(module.video_url!)}
                testID="module-video"
              >
                <Ionicons name="play-circle" size={22} color={Colors.teal} />
                <Text style={styles.linkTxt}>Watch the video</Text>
                <Ionicons name="open-outline" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
            {!!module.content_url && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => Linking.openURL(module.content_url!)}
                testID="module-content"
              >
                <Ionicons name="document-text" size={22} color={Colors.teal} />
                <Text style={styles.linkTxt}>Read the material</Text>
                <Ionicons name="open-outline" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ------------------------------------------------------ quiz --- */}
        {questions.length === 0 ? (
          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.noteTxt}>
              This module has no quiz — work through the material above to complete it.
            </Text>
          </View>
        ) : result ? (
          <View
            style={[
              styles.resultCard,
              { backgroundColor: result.passed ? Colors.successBg : Colors.errorBg },
            ]}
            testID="quiz-result"
          >
            <Ionicons
              name={result.passed ? 'checkmark-circle' : 'close-circle'}
              size={40}
              color={result.passed ? Colors.success : Colors.danger}
            />
            <Text
              style={[
                styles.resultTitle,
                { color: result.passed ? Colors.success : Colors.danger },
              ]}
            >
              {result.passed ? 'Passed' : 'Not passed'}
            </Text>
            <Text style={styles.resultScore}>
              You scored {result.score}% (pass mark {module.pass_percent}%)
            </Text>
            {(result.qualification_unlocked?.length ?? 0) > 0 && (
              <Text style={styles.unlockTxt}>
                This unlocked {result.qualification_unlocked!.length} new care package
                {result.qualification_unlocked!.length === 1 ? '' : 's'} you can now take on.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md }}>
              {!result.passed && (
                <GradientButton
                  title="Try again"
                  variant="outline"
                  fullWidth={false}
                  onPress={retake}
                />
              )}
              <GradientButton
                title="Back to training"
                fullWidth={false}
                onPress={() => router.replace('/training')}
              />
            </View>
          </View>
        ) : !quizOpen ? (
          <GradientButton
            title="Start the quiz"
            onPress={() => setQuizOpen(true)}
            style={{ marginTop: Spacing.sm }}
            testID="start-quiz"
          />
        ) : (
          <>
            <Text style={styles.secTitle}>Quiz</Text>
            {questions.map((q, qi) => (
              <View key={q.id} style={styles.card} testID={`question-${q.id}`}>
                <Text style={styles.question}>
                  {qi + 1}. {q.question}
                </Text>
                {(q.options ?? []).map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.option, selected && styles.optionActive]}
                      onPress={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      testID={`option-${q.id}-${oi}`}
                    >
                      <View style={[styles.radio, selected && styles.radioOn]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.optionTxt}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <GradientButton
              title={allAnswered ? 'Submit answers' : 'Answer every question to submit'}
              onPress={submitQuiz}
              disabled={!allAnswered}
              loading={submitting}
              style={{ marginTop: Spacing.sm }}
              testID="submit-quiz"
            />
          </>
        )}
      </ScrollView>
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
  title: { ...Typography.h3, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' as const },
  desc: { ...Typography.body, color: Colors.textSecondary, marginTop: 12, lineHeight: 21 },
  secTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  linkTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  noteCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: 12,
  },
  noteTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  question: { ...Typography.bodyBold, color: Colors.textPrimary, marginBottom: 12, lineHeight: 21 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 8,
  },
  optionActive: { borderColor: Colors.teal, backgroundColor: '#CCFBF1' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal },
  optionTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  resultCard: { borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center' },
  resultTitle: { ...Typography.h2, marginTop: 8 },
  resultScore: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  unlockTxt: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
});
