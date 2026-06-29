import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../components/Header';
import { InputField } from '../../components/InputField';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';
import { SupportTicket } from '../../types';

const CATEGORIES: SupportTicket['category'][] = ['booking', 'payment', 'nurse', 'app', 'other'];

export default function RaiseTicket() {
  const router = useRouter();
  const addTicket = useStore((s) => s.addTicket);
  const [subject, setSubject] = useState('');
  const [cat, setCat] = useState<SupportTicket['category']>('booking');
  const [desc, setDesc] = useState('');

  const submit = () => {
    if (!subject.trim() || !desc.trim()) {
      Alert.alert('Please fill subject and description');
      return;
    }
    const t: SupportTicket = {
      id: 't' + Date.now(),
      subject,
      category: cat,
      description: desc,
      status: 'open',
      createdAt: 'just now',
      updates: [{ time: 'just now', message: 'Ticket raised by you', from: 'you' }],
    };
    addTicket(t);
    Alert.alert('Ticket created', `#${t.id.toUpperCase()} — we’ll respond within 24 hours`, [
      { text: 'OK', onPress: () => router.replace({ pathname: '/support/ticket/[id]', params: { id: t.id } }) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="raise-ticket" edges={['top']}>
      <OfflineBanner />
      <Header title="Raise a ticket" fallbackHref="/support" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
          <InputField label="Subject" placeholder="Short summary of the issue" value={subject} onChangeText={setSubject} testID="ticket-subject" />
          <Text style={styles.label}>Category</Text>
          <View style={styles.row}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCat(c)}
                style={[styles.chip, cat === c && styles.chipActive]}
                testID={`cat-${c}`}
              >
                <Text style={[styles.chipTxt, cat === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <InputField
            label="Describe the issue"
            placeholder="Please give us details so we can resolve quickly…"
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={5}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            testID="ticket-desc"
          />
          <GradientButton title="Submit ticket" onPress={submit} testID="ticket-submit" style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  label: { ...Typography.small, color: Colors.textSecondary, marginBottom: 8, fontWeight: '600' as const },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.surface, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const, textTransform: 'capitalize' },
});
