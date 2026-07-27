/**
 * Help centre — FAQs published by Operations plus this user's support tickets.
 *
 * The FAQ list is fetched rather than hardcoded: Operations maintains it in
 * the web portal, and the backend already filters to the right audience
 * (consumer vs worker) based on who is asking.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { GradientButton } from '../components/GradientButton';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import {
  supportService,
  type Faq,
  type SupportTicketOut,
  type TicketStatus,
} from '../services/support.service';
import { relativeTime } from '../lib/format';

const STATUS_TONE: Record<TicketStatus, { bg: string; fg: string; label: string }> = {
  open: { bg: Colors.warningBg, fg: Colors.warning, label: 'Open' },
  in_progress: { bg: Colors.infoBg, fg: Colors.primary, label: 'In progress' },
  resolved: { bg: Colors.successBg, fg: Colors.success, label: 'Resolved' },
  closed: { bg: Colors.surfaceAlt, fg: Colors.textSecondary, label: 'Closed' },
};

export default function Support() {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [tickets, setTickets] = useState<SupportTicketOut[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    // Load both independently so a failure in one doesn't blank the other.
    const [faqRes, ticketRes] = await Promise.allSettled([
      supportService.faqs(),
      supportService.myTickets(),
    ]);
    if (faqRes.status === 'fulfilled') setFaqs(faqRes.value);
    if (ticketRes.status === 'fulfilled') setTickets(ticketRes.value);
    if (faqRes.status === 'rejected' && ticketRes.status === 'rejected') {
      setError('Could not reach the help centre. Check your connection and try again.');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} testID="support-screen" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Help & support"
        fallbackHref={role === 'nurse' ? '/(nurse)/profile' : '/(family)/profile'}
      />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ------------------------------------------------- emergency --- */}
        <LinearGradient colors={['#FEE2E2', '#FECACA'] as any} style={styles.emergency}>
          <View style={styles.emergencyIcon}>
            <Ionicons name="alert" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emergencyTitle}>Medical emergency?</Text>
            <Text style={styles.emergencySub}>Call 108 immediately for an ambulance</Text>
          </View>
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => Linking.openURL('tel:108')}
            testID="emergency-call"
          >
            <Ionicons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* --------------------------------------------------- tickets --- */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Your requests</Text>
          <TouchableOpacity onPress={() => router.push('/support/raise')} testID="raise-ticket">
            <Text style={styles.link}>New request</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
        ) : tickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              No open requests. If something isn’t right with a visit, a payment or your account,
              raise a request and our support team will pick it up.
            </Text>
            <GradientButton
              title="Raise a request"
              variant="outline"
              fullWidth={false}
              onPress={() => router.push('/support/raise')}
              style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
            />
          </View>
        ) : (
          tickets.map((t) => {
            const tone = STATUS_TONE[t.status] ?? STATUS_TONE.open;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.ticketCard}
                onPress={() =>
                  router.push({ pathname: '/support/ticket/[id]', params: { id: t.id } })
                }
                testID={`ticket-${t.id}`}
              >
                <View style={styles.ticketHead}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusTxt, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.ticketMeta}>
                  {t.ticket_ref} · raised {relativeTime(t.created_at)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* ------------------------------------------------------ FAQs --- */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl, marginBottom: Spacing.sm }]}>
          Frequently asked
        </Text>

        {loading ? null : faqs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              No help articles have been published yet. Raise a request and we’ll answer directly.
            </Text>
          </View>
        ) : (
          faqs.map((f) => {
            const isOpen = openFaq === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={styles.faqCard}
                onPress={() => setOpenFaq(isOpen ? null : f.id)}
                testID={`faq-${f.id}`}
              >
                <View style={styles.faqHead}>
                  <Text style={styles.faqQ}>{f.question}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textTertiary}
                  />
                </View>
                {isOpen && <Text style={styles.faqA}>{f.answer}</Text>}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
  },
  emergencyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTitle: { ...Typography.bodyBold, color: Colors.danger },
  emergencySub: { ...Typography.small, color: Colors.danger, marginTop: 2 },
  emergencyBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: Colors.errorBg,
    padding: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  errorTxt: { ...Typography.small, color: Colors.danger, flex: 1 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary },
  link: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    ...Shadows.card,
  },
  emptyTxt: { ...Typography.small, color: Colors.textSecondary, lineHeight: 18 },
  ticketCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketSubject: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  statusTxt: { ...Typography.caption, fontWeight: '700' as const },
  ticketMeta: { ...Typography.caption, color: Colors.textTertiary, marginTop: 6 },
  faqCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQ: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  faqA: { ...Typography.small, color: Colors.textSecondary, marginTop: 10, lineHeight: 19 },
});
