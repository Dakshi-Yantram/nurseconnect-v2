/**
 * Secure assessment session — one question at a time.
 *
 * State lives entirely on the server: it decides the question order, shuffles
 * the options, and grades each answer as it arrives. This screen therefore
 * never holds the answer key, and there is no way to look ahead. Backing out
 * does not discard the attempt — `start` resumes the same session — so the
 * screen is explicit about that rather than implying a clean exit.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import {
  trainingService,
  type SessionQuestion,
  type AssessmentOut,
} from '../../services/training.service';

interface Finished {
  score: number;
  passed: boolean;
  pass_score: number;
  qualification_unlocked: string[];
}

export default function AssessmentSession() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadAssessmentsAPI = useStore((s) => s.loadAssessmentsAPI);

  const [assessment, setAssessment] = useState<AssessmentOut | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<SessionQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [multi, setMulti] = useState<number[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [error, setError] = useState('');

  const startedRef = useRef(false);

  const start = useCallback(async () => {
    if (!id || startedRef.current) return;
    startedRef.current = true;
    try {
      const [meta, session] = await Promise.all([
        trainingService.getAssessment(id).catch(() => null),
        trainingService.startSession(id),
      ]);
      if (meta) setAssessment(meta);
      setSessionId(session.session_id);
      setQuestion(session.question);
      setExpiresAt(session.expires_at);
    } catch (e: any) {
      // 403 carries the reason (attempts exhausted, cooldown active).
      setError(
        typeof e?.detail === 'string'
          ? e.detail
          : e?.detail?.message || e?.message || 'Could not start this assessment',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    start();
  }, [start]);

  // Countdown against the server's expiry, recomputed from the wall clock so a
  // backgrounded app can't drift into showing time it doesn't have.
  useEffect(() => {
    if (!expiresAt || finished) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, finished]);

  // Warn before leaving mid-attempt — the session stays open server-side.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (finished || !sessionId) return false;
      confirmExit();
      return true;
    });
    return () => sub.remove();
  });

  const confirmExit = () => {
    Alert.alert(
      'Leave this attempt?',
      'Your attempt stays open and the timer keeps running. You can come back and pick up from this question.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ],
    );
  };

  const answerReady = (() => {
    if (!question) return false;
    if (question.type === 'text') return textAnswer.trim().length > 0;
    if (question.type === 'multi_select') return multi.length > 0;
    return selected !== null;
  })();

  const submitAnswer = async () => {
    if (!id || !sessionId || !question || !answerReady) return;
    setSubmitting(true);
    try {
      const answer =
        question.type === 'text'
          ? textAnswer.trim()
          : question.type === 'multi_select'
            ? multi
            : selected;

      const res = await trainingService.answerSession(id, sessionId, answer);
      setSelected(null);
      setTextAnswer('');
      setMulti([]);

      if (res.finished) {
        setFinished({
          score: res.score,
          passed: res.passed,
          pass_score: res.pass_score,
          qualification_unlocked: res.qualification_unlocked ?? [],
        });
        loadAssessmentsAPI().catch(() => {});
      } else {
        setQuestion(res.question);
      }
    } catch (e: any) {
      Alert.alert(
        'Could not submit',
        typeof e?.detail === 'string' ? e.detail : e?.message || 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------- renders --
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Assessment" showBack={false} />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Assessment" showBack={false} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error}</Text>
          <GradientButton
            title="Back to assessments"
            fullWidth={false}
            onPress={() => router.replace('/assessments')}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID="assessment-result">
        <Header title="Result" showBack={false} />
        <View style={styles.centered}>
          <Ionicons
            name={finished.passed ? 'checkmark-circle' : 'close-circle'}
            size={72}
            color={finished.passed ? Colors.success : Colors.danger}
          />
          <Text
            style={[
              styles.resultTitle,
              { color: finished.passed ? Colors.success : Colors.danger },
            ]}
          >
            {finished.passed ? 'Passed' : 'Not passed'}
          </Text>
          <Text style={styles.resultScore}>
            You scored {finished.score}% · pass mark {finished.pass_score}%
          </Text>

          {finished.qualification_unlocked.length > 0 && (
            <View style={styles.unlockCard}>
              <Ionicons name="lock-open" size={18} color={Colors.success} />
              <Text style={styles.unlockTxt}>
                {finished.qualification_unlocked.length} new care package
                {finished.qualification_unlocked.length === 1 ? '' : 's'} unlocked — you can start
                accepting them now.
              </Text>
            </View>
          )}

          <GradientButton
            title="Back to assessments"
            onPress={() => router.replace('/assessments')}
            style={{ marginTop: Spacing.lg }}
            testID="result-done"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!question) return null;

  const progress = question.question_number / Math.max(question.total_questions, 1);
  const timeCritical = secondsLeft !== null && secondsLeft <= 60;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="assessment-session">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={confirmExit} testID="assessment-exit" style={styles.exitBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {assessment?.title || 'Assessment'}
        </Text>
        {secondsLeft !== null ? (
          <View style={[styles.timer, timeCritical && { backgroundColor: Colors.errorBg }]}>
            <Ionicons
              name="time-outline"
              size={13}
              color={timeCritical ? Colors.danger : Colors.textSecondary}
            />
            <Text style={[styles.timerTxt, timeCritical && { color: Colors.danger }]}>
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
              {String(secondsLeft % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : (
          <View style={styles.exitBtn} />
        )}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.counter}>
          Question {question.question_number} of {question.total_questions}
        </Text>
        <Text style={styles.question}>{question.text}</Text>

        {question.type === 'text' ? (
          <View style={styles.textAnswerBox}>
            <Text style={styles.textAnswerHint}>Type your answer</Text>
            <TextInput
              style={styles.textInputShell}
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder="Write your answer here…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
              testID="assessment-text-answer"
            />
          </View>
        ) : (
          question.options.map((opt, i) => {
            const isMulti = question.type === 'multi_select';
            const on = isMulti ? multi.includes(i) : selected === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, on && styles.optionActive]}
                onPress={() =>
                  isMulti
                    ? setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))
                    : setSelected(i)
                }
                testID={`option-${i}`}
              >
                <View
                  style={[
                    isMulti ? styles.checkbox : styles.radio,
                    on && (isMulti ? styles.checkboxOn : styles.radioOn),
                  ]}
                >
                  {on &&
                    (isMulti ? (
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    ) : (
                      <View style={styles.radioDot} />
                    ))}
                </View>
                <Text style={styles.optionTxt}>{opt}</Text>
              </TouchableOpacity>
            );
          })
        )}

        {question.type === 'multi_select' && (
          <Text style={styles.hint}>Select all that apply.</Text>
        )}
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <GradientButton
          title={
            question.question_number === question.total_questions ? 'Finish' : 'Next question'
          }
          onPress={submitAnswer}
          disabled={!answerReady}
          loading={submitting}
          testID="assessment-next"
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  errorTxt: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 21,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  exitBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  timerTxt: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700' as const },
  progressTrack: { height: 4, backgroundColor: Colors.surfaceAlt },
  progressFill: { height: 4, backgroundColor: Colors.teal },
  resultTitle: { ...Typography.h1, marginTop: Spacing.md },
  resultScore: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
  unlockCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.successBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  unlockTxt: { ...Typography.small, color: Colors.success, flex: 1, lineHeight: 18 },
  counter: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 8 },
  question: { ...Typography.h3, color: Colors.textPrimary, lineHeight: 28, marginBottom: Spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 10,
    ...Shadows.card,
  },
  optionActive: { borderColor: Colors.teal, backgroundColor: '#CCFBF1' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.teal },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.teal },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  optionTxt: { ...Typography.body, color: Colors.textPrimary, flex: 1, lineHeight: 21 },
  hint: { ...Typography.small, color: Colors.textTertiary, marginTop: 4 },
  textAnswerBox: { gap: 8 },
  textAnswerHint: { ...Typography.small, color: Colors.textSecondary },
  textInputShell: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    minHeight: 120,
  },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
