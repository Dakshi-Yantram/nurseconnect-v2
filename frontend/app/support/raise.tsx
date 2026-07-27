import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { supportService, TICKET_CATEGORIES } from '../../services/support.service';

/** Raise a support ticket. Optionally attached to a specific booking. */
export default function RaiseTicket() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  const [category, setCategory] = useState<string>(bookingId ? 'booking' : 'other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!subject.trim()) return Alert.alert('Add a subject', 'A short summary helps us route it.');
    if (description.trim().length < 10) {
      return Alert.alert(
        'Tell us a bit more',
        'Please describe what happened so support can help without going back and forth.',
      );
    }
    setSubmitting(true);
    try {
      const ticket = await supportService.createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        booking_id: bookingId,
      });
      router.replace({ pathname: '/support/ticket/[id]', params: { id: ticket.id } });
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="raise-ticket-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Raise a request" fallbackHref="/support" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            Tell us what’s going on and our support team will get back to you in the app.
          </Text>

          <Text style={styles.fieldLabel}>What’s this about?</Text>
          <View style={styles.chipRow}>
            {TICKET_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, category === c.id && styles.chipActive]}
                onPress={() => setCategory(c.id)}
                testID={`category-${c.id}`}
              >
                <Text style={[styles.chipTxt, category === c.id && { color: '#fff' }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <InputField
            label="Subject"
            placeholder="Short summary"
            value={subject}
            onChangeText={setSubject}
            maxLength={120}
            testID="ticket-subject"
          />
          <InputField
            label="What happened?"
            placeholder="Include dates, amounts or the nurse’s name if relevant."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            style={{ minHeight: 140, textAlignVertical: 'top' }}
            testID="ticket-description"
          />

          {!!bookingId && (
            <View style={styles.linkedCard}>
              <Text style={styles.linkedTxt}>
                This request will be linked to your booking so support can see its full history.
              </Text>
            </View>
          )}

          <GradientButton
            title="Submit request"
            onPress={submit}
            loading={submitting}
            style={{ marginTop: Spacing.md }}
            testID="ticket-submit"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  lead: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 21,
  },
  fieldLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  linkedCard: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 12 },
  linkedTxt: { ...Typography.small, color: Colors.primary, lineHeight: 18 },
});
