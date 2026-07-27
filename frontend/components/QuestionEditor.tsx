import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import type { AssessmentQuestion } from '../services/training.service';

interface Props {
  questions: AssessmentQuestion[];
  onChange: (next: AssessmentQuestion[]) => void;
}

/**
 * Multiple-choice question authoring.
 *
 * Restricted to `single_select` because that's the only type the module-quiz
 * scorer grades — the backend's `_score_attempt` compares a single
 * `correct_index`. Offering multi-select or free-text here would produce
 * questions that can never be marked correct.
 */
export const QuestionEditor: React.FC<Props> = ({ questions, onChange }) => {
  const update = (index: number, patch: Partial<AssessmentQuestion>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => {
    onChange([
      ...questions,
      {
        id: `q${questions.length + 1}-${Date.now().toString(36)}`,
        type: 'single_select',
        question: '',
        options: ['', ''],
        correct_index: 0,
        explanation: '',
        difficulty: 2,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    Alert.alert('Remove this question?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onChange(questions.filter((_, i) => i !== index)),
      },
    ]);
  };

  const addOption = (qi: number) => {
    const opts = [...(questions[qi].options ?? []), ''];
    update(qi, { options: opts });
  };

  const removeOption = (qi: number, oi: number) => {
    const q = questions[qi];
    const opts = (q.options ?? []).filter((_, i) => i !== oi);
    if (opts.length < 2) {
      Alert.alert('At least two options', 'A question needs two or more answers to choose from.');
      return;
    }
    // Keep `correct_index` pointing at the same answer after the shift.
    let correct = q.correct_index ?? 0;
    if (oi === correct) correct = 0;
    else if (oi < correct) correct -= 1;
    update(qi, { options: opts, correct_index: correct });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Quiz questions</Text>
        <Text style={styles.count}>{questions.length}</Text>
      </View>
      <Text style={styles.hint}>
        Each question has one correct answer. Nurses see the options in a shuffled order.
      </Text>

      {questions.map((q, qi) => (
        <View key={q.id ?? qi} style={styles.card} testID={`question-editor-${qi}`}>
          <View style={styles.cardHead}>
            <Text style={styles.qNum}>Question {qi + 1}</Text>
            <TouchableOpacity onPress={() => removeQuestion(qi)} testID={`remove-question-${qi}`}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="What should the nurse know?"
            placeholderTextColor={Colors.textTertiary}
            value={q.question ?? ''}
            onChangeText={(v) => update(qi, { question: v })}
            multiline
          />

          <Text style={styles.label}>Answers — tap the circle to mark the correct one</Text>
          {(q.options ?? []).map((opt, oi) => {
            const correct = (q.correct_index ?? 0) === oi;
            return (
              <View key={oi} style={styles.optionRow}>
                <TouchableOpacity
                  onPress={() => update(qi, { correct_index: oi })}
                  style={[styles.radio, correct && styles.radioOn]}
                  testID={`correct-${qi}-${oi}`}
                >
                  {correct && <Ionicons name="checkmark" size={13} color="#fff" />}
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.optionInput]}
                  placeholder={`Answer ${oi + 1}`}
                  placeholderTextColor={Colors.textTertiary}
                  value={opt}
                  onChangeText={(v) => {
                    const opts = [...(q.options ?? [])];
                    opts[oi] = v;
                    update(qi, { options: opts });
                  }}
                />
                <TouchableOpacity onPress={() => removeOption(qi, oi)}>
                  <Ionicons name="close" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addOption} onPress={() => addOption(qi)}>
            <Ionicons name="add" size={15} color={Colors.primary} />
            <Text style={styles.addOptionTxt}>Add another answer</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            placeholder="Explanation shown after answering (optional)"
            placeholderTextColor={Colors.textTertiary}
            value={q.explanation ?? ''}
            onChangeText={(v) => update(qi, { explanation: v })}
            multiline
          />
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addQuestion} testID="add-question">
        <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
        <Text style={styles.addTxt}>Add a question</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...Typography.h4, color: Colors.textPrimary },
  count: { ...Typography.small, color: Colors.textSecondary, fontWeight: '700' as const },
  hint: { ...Typography.small, color: Colors.textTertiary, marginTop: 4, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  qNum: { ...Typography.small, color: Colors.textSecondary, fontWeight: '700' as const },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: 8,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionInput: { flex: 1 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  addOptionTxt: { ...Typography.small, color: Colors.primary, fontWeight: '600' as const },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  addTxt: { ...Typography.body, color: Colors.accent, fontWeight: '700' as const },
});
