import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../../components/Header';
import { InputField } from '../../../components/InputField';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../constants/theme';
import { useStore } from '../../../store';

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tickets = useStore((s) => s.tickets);
  const append = useStore((s) => s.appendTicketUpdate);
  const t = tickets.find((x) => x.id === id);
  const [msg, setMsg] = useState('');

  if (!t) return null;

  const send = () => {
    if (!msg.trim()) return;
    append(t.id, msg.trim());
    setMsg('');
  };

  return (
    <SafeAreaView style={styles.safe} testID="ticket-detail" edges={['top']}>
      <OfflineBanner />
      <Header title={`#${t.id.toUpperCase()}`} subtitle={t.subject} fallbackHref="/support" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 16 }}>
          <View style={styles.metaCard}>
            <View style={styles.row}>
              <Text style={styles.k}>Status</Text>
              <View style={[styles.badge, { backgroundColor: t.status === 'resolved' ? Colors.successBg : Colors.warningBg }]}>
                <Text style={[styles.badgeTxt, { color: t.status === 'resolved' ? Colors.success : Colors.warning }]}>
                  {t.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Category</Text>
              <Text style={styles.v}>{t.category}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Raised</Text>
              <Text style={styles.v}>{t.createdAt}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.body}>{t.description}</Text>
          </View>

          <Text style={styles.section}>Conversation</Text>
          {t.updates.map((u, i) => (
            <View key={i} style={[styles.bubble, u.from === 'you' ? styles.bubbleYou : styles.bubbleSupport]}>
              <Text style={[styles.bubbleFrom, u.from === 'you' && { color: '#fff' }]}>
                {u.from === 'you' ? 'You' : 'Support'} · {u.time}
              </Text>
              <Text style={[styles.bubbleMsg, u.from === 'you' && { color: '#fff' }]}>{u.message}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <InputField
            placeholder="Type a reply…"
            value={msg}
            onChangeText={setMsg}
            style={{ flex: 1 }}
            testID="ticket-reply"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} testID="ticket-send">
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  metaCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, ...Shadows.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  k: { ...Typography.small, color: Colors.textSecondary },
  v: { ...Typography.bodyBold, color: Colors.textPrimary, textTransform: 'capitalize' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeTxt: { ...Typography.caption, fontWeight: '700' as const, textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 10 },
  body: { ...Typography.body, color: Colors.textPrimary, lineHeight: 22 },
  section: { ...Typography.h4, color: Colors.textPrimary, marginTop: 20, marginBottom: 10 },
  bubble: { padding: 12, borderRadius: Radius.lg, marginBottom: 8, maxWidth: '85%' },
  bubbleYou: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },
  bubbleSupport: { backgroundColor: Colors.surface, alignSelf: 'flex-start', ...Shadows.card },
  bubbleFrom: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 4 },
  bubbleMsg: { ...Typography.body, color: Colors.textPrimary },
  composer: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 8, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.divider },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
});
