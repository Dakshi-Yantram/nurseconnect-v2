import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../../components/Header';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../constants/theme';
import { useStore } from '../../../store';
import { supportService, type SupportTicketDetail } from '../../../services/support.service';
import { relativeTime } from '../../../lib/format';

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: Colors.warningBg, fg: Colors.warning, label: 'Open' },
  in_progress: { bg: Colors.infoBg, fg: Colors.primary, label: 'In progress' },
  resolved: { bg: Colors.successBg, fg: Colors.success, label: 'Resolved' },
  closed: { bg: Colors.surfaceAlt, fg: Colors.textSecondary, label: 'Closed' },
};

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.user);

  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTicket(await supportService.getTicket(id));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load this request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const message = draft.trim();
    if (!message || !id || sending) return;
    setSending(true);
    try {
      await supportService.addMessage(id, message);
      setDraft('');
      // Re-read rather than appending locally so the status change support
      // makes when they reply (open -> in progress) is reflected too.
      await load();
    } catch (e: any) {
      setError(e?.message || 'Message not sent');
    } finally {
      setSending(false);
    }
  };

  const tone = ticket ? (STATUS_TONE[ticket.status] ?? STATUS_TONE.open) : STATUS_TONE.open;
  const closed = ticket?.status === 'closed';

  return (
    <SafeAreaView style={styles.safe} testID="ticket-detail" edges={['top']}>
      <OfflineBanner />
      <Header title={ticket?.ticket_ref || 'Request'} fallbackHref="/support" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !ticket ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={38} color={Colors.textTertiary} />
          <Text style={styles.errorTxt}>{error || 'This request could not be found.'}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 30 }}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.subject}>{ticket.subject}</Text>
                <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusTxt, { color: tone.fg }]}>{tone.label}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {ticket.ticket_ref} · raised {relativeTime(ticket.created_at)}
              </Text>
              <Text style={styles.description}>{ticket.description}</Text>

              {!!ticket.resolution_notes && (
                <View style={styles.resolution}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resolutionLabel}>Resolution</Text>
                    <Text style={styles.resolutionTxt}>{ticket.resolution_notes}</Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Conversation</Text>
            {ticket.messages.length === 0 ? (
              <Text style={styles.emptyTxt}>
                No replies yet. Our support team will respond here.
              </Text>
            ) : (
              ticket.messages.map((m) => {
                const mine = m.sender_id === me?.id;
                return (
                  <View key={m.id} style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {!mine && <Text style={styles.senderName}>{m.sender_name}</Text>}
                      <Text style={[styles.bubbleTxt, mine && { color: '#fff' }]}>{m.message}</Text>
                      <Text
                        style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}
                      >
                        {relativeTime(m.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {!!error && (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle" size={14} color={Colors.danger} />
              <Text style={styles.errorBarTxt}>{error}</Text>
            </View>
          )}

          {closed ? (
            <View style={styles.closedBar}>
              <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
              <Text style={styles.closedTxt}>
                This request is closed. Raise a new one if you still need help.
              </Text>
            </View>
          ) : (
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="Add a reply…"
                placeholderTextColor={Colors.textTertiary}
                value={draft}
                onChangeText={setDraft}
                multiline
                testID="ticket-reply"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
                onPress={send}
                disabled={!draft.trim() || sending}
                testID="ticket-send"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
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
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.card,
    ...Shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  subject: { ...Typography.h4, color: Colors.textPrimary, flex: 1 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  statusTxt: { ...Typography.caption, fontWeight: '700' as const },
  meta: { ...Typography.caption, color: Colors.textTertiary, marginTop: 6 },
  description: { ...Typography.body, color: Colors.textSecondary, marginTop: 12, lineHeight: 21 },
  resolution: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Spacing.md,
  },
  resolutionLabel: { ...Typography.caption, color: Colors.success, fontWeight: '700' as const },
  resolutionTxt: { ...Typography.small, color: Colors.success, marginTop: 2, lineHeight: 18 },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '85%', borderRadius: Radius.lg, padding: 12 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  senderName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  bubbleTxt: { ...Typography.body, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTime: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  errorBarTxt: { ...Typography.small, color: Colors.danger, flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  closedTxt: { ...Typography.small, color: Colors.textSecondary, flex: 1 },
});
