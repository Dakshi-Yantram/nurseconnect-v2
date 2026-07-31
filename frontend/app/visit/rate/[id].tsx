/**
 * Consumer: rate a completed visit.
 *
 * `visit/[id].tsx` used to send "Rate this visit" to `/visit-success/[id]`,
 * which is the NURSE's post-checkout screen — it renders vitals from the
 * nurse's local `careNotes` store (never populated on the consumer device)
 * and auto-redirects to the nurse's assignments tab after 3.5s. That's the
 * "goes to a screen, then bounces to home after a few seconds" bug. This
 * screen replaces that navigation with an actual rating UI that calls
 * POST /visits/{id}/rating.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../../components/Header';
import { GradientButton } from '../../../components/GradientButton';
import { InputField } from '../../../components/InputField';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../constants/theme';
import { visitsService } from '../../../services/visits.service';

const LABELS = ['Poor', 'Below average', 'Good', 'Very good', 'Excellent'];

export default function RateVisit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!id) return;
    if (rating < 1) {
      setError('Please select a star rating.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await visitsService.submitRating(id, rating, comment.trim() || undefined);
      Alert.alert('Thank you!', 'Your feedback has been submitted.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.detail?.message || e?.message || 'Could not submit your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="rate-visit-screen">
      <Header title="Rate this visit" fallbackHref={`/visit/${id || ''}`} />

      <View style={{ padding: Spacing.lg }}>
        <View style={styles.card}>
          <Text style={styles.title}>How was your care visit?</Text>
          <Text style={styles.sub}>Your feedback helps us improve the care your family receives.</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => {
                  setRating(n);
                  setError('');
                }}
                testID={`star-${n}`}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={Colors.warning}
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && <Text style={styles.ratingLabel}>{LABELS[rating - 1]}</Text>}

          <InputField
            label="Additional comments (optional)"
            placeholder="Tell us more about your experience…"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />

          {!!error && <Text style={styles.errorTxt}>{error}</Text>}

          <GradientButton
            title="Submit feedback"
            onPress={submit}
            loading={submitting}
            style={{ marginTop: Spacing.md }}
            testID="submit-rating"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    ...Shadows.card,
  },
  title: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center' },
  sub: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.sm },
  ratingLabel: {
    ...Typography.bodyBold,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: Spacing.lg,
  },
  errorTxt: { ...Typography.small, color: Colors.danger, marginTop: 8, textAlign: 'center' },
});