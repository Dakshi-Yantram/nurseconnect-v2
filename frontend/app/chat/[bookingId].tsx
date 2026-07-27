/**
 * Consumer <-> nurse chat for a single booking.
 *
 * `can_send` is re-derived by the backend from the live booking status on
 * every request, so it is read from each fetch rather than cached — a visit
 * that completes mid-conversation closes the composer on the next poll.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { messagingService, type ChatMessage } from '../../services/messaging.service';
import { useStore } from '../../store';
import { relativeTime } from '../../lib/format';

const POLL_MS = 10_000;

export default function BookingChat() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const me = useStore((s) => s.user);
  const role = useStore((s) => s.role);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canSend, setCanSend] = useState(true);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(
    async (showSpinner = false) => {
      if (!bookingId) return;
      if (showSpinner) setLoading(true);
      try {
        const thread = await messagingService.bookingThread(bookingId);
        setMessages(thread.messages);
        setCanSend(thread.can_send);
        setDisabledReason(thread.disabled_reason);
        setError('');
      } catch (e: any) {
        // 409 means no nurse has been assigned yet — a normal state, not a
        // failure, so it gets its own copy instead of a raw error.
        if (e?.status === 409) {
          setCanSend(false);
          setDisabledReason('Messaging opens once a nurse accepts this booking.');
          setError('');
        } else {
          setError(e?.message || 'Could not load messages');
        }
      } finally {
        setLoading(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !bookingId || sending) return;
    setSending(true);
    try {
      const msg = await messagingService.sendToBooking(bookingId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e: any) {
      if (e?.status === 409) {
        // The visit closed between loading the thread and hitting send.
        setCanSend(false);
        setDisabledReason(
          typeof e?.detail === 'string' ? e.detail : 'This conversation is now closed.',
        );
      } else {
        setError(e?.message || 'Message not sent');
      }
    } finally {
      setSending(false);
    }
  };

  const otherPartyLabel = role === 'nurse' ? 'the family' : 'your nurse';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="chat-screen">
      <Header
        title="Messages"
        subtitle={`Chat with ${otherPartyLabel}`}
        fallbackHref={role === 'nurse' ? '/(nurse)/assignments' : '/(family)/visits'}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={36} color={Colors.textTertiary} />
                <Text style={styles.emptyTxt}>
                  No messages yet. Say hello — {otherPartyLabel} will see it right away.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === me?.id;
              return (
                <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {!mine && <Text style={styles.senderName}>{item.sender_name}</Text>}
                    <Text style={[styles.bubbleTxt, mine && { color: '#fff' }]}>{item.body}</Text>
                    <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                      {relativeTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {!!error && (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle" size={14} color={Colors.danger} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {canSend ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Write a message…"
              placeholderTextColor={Colors.textTertiary}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
              testID="chat-input"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
              onPress={send}
              disabled={!draft.trim() || sending}
              testID="chat-send"
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.closedBar} testID="chat-closed">
            <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
            <Text style={styles.closedTxt}>
              {disabledReason || 'This conversation is closed.'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: Spacing.xl },
  emptyTxt: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, padding: 12 },
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
  errorTxt: { ...Typography.small, color: Colors.danger, flex: 1 },
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
    paddingTop: 12,
    paddingBottom: 12,
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
