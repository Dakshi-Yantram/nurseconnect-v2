import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

const FAQS = [
  { q: 'How do I cancel a booking?', a: 'Open the visit from My Visits and tap “Cancel”. Refunds are processed within 3-5 working days.' },
  { q: 'How is the BPL subsidy applied?', a: 'If your account is BPL-verified, a 20-25% subsidy is automatically deducted from every booking total.' },
  { q: 'Are nurses background verified?', a: 'Yes. Every nurse undergoes police verification, license checks and a 5-day in-house orientation.' },
  { q: 'What if the nurse arrives late?', a: 'You receive automatic delay notifications. Visits delayed by 30+ mins are eligible for a 15% goodwill credit.' },
  { q: 'How do I link my ABHA?', a: 'Go to Profile → ABHA records and follow the link. Your existing health records will sync automatically.' },
];

export default function Support() {
  const router = useRouter();
  const tickets = useStore((s) => s.tickets);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.safe} testID="support-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Help & Support" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        {/* Emergency banner */}
        <LinearGradient
          colors={['#FEE2E2', '#FECACA'] as any}
          style={styles.emergency}
        >
          <View style={styles.emergencyIcon}>
            <Ionicons name="alert" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emergencyTitle}>Medical emergency?</Text>
            <Text style={styles.emergencySub}>Call 108 immediately for ambulance</Text>
          </View>
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => Linking.openURL('tel:108')}
            testID="emergency-call"
          >
            <Ionicons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Contact options */}
        <Text style={styles.section}>Get in touch</Text>
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => Linking.openURL('tel:18002221234')}
            testID="contact-call"
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.successBg }]}>
              <Ionicons name="call" size={20} color={Colors.success} />
            </View>
            <Text style={styles.contactLabel}>Call us</Text>
            <Text style={styles.contactSub}>1800-222-1234</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => Linking.openURL('https://wa.me/911800222123')}
            testID="contact-whatsapp"
          >
            <View style={[styles.contactIcon, { backgroundColor: '#DCFCE7' }]}>
              <FontAwesome5 name="whatsapp" size={18} color="#16A34A" />
            </View>
            <Text style={styles.contactLabel}>WhatsApp</Text>
            <Text style={styles.contactSub}>9am-9pm</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => router.push('/support/raise')}
            testID="contact-ticket"
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.warningBg }]}>
              <MaterialCommunityIcons name="ticket-confirmation" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.contactLabel}>Raise a ticket</Text>
            <Text style={styles.contactSub}>Get tracked support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => Alert.alert('Live chat', 'A care expert will be with you shortly')}
            testID="contact-chat"
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.infoBg }]}>
              <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.contactLabel}>Live chat</Text>
            <Text style={styles.contactSub}>Avg. wait 2 mins</Text>
          </TouchableOpacity>
        </View>

        {/* My tickets */}
        <Text style={styles.section}>My tickets</Text>
        {tickets.length === 0 ? (
          <Text style={styles.empty}>No tickets yet</Text>
        ) : (
          tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.ticketRow}
              onPress={() => router.push({ pathname: '/support/ticket/[id]', params: { id: t.id } })}
              testID={`ticket-${t.id}`}
            >
              <View style={[styles.ticketDot, { backgroundColor: t.status === 'resolved' ? Colors.success : t.status === 'in_progress' ? Colors.warning : Colors.primary }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.ticketTitle} numberOfLines={1}>{t.subject}</Text>
                <Text style={styles.ticketSub}>#{t.id.toUpperCase()} · {t.createdAt}</Text>
              </View>
              <Text style={[styles.ticketStatus, { color: t.status === 'resolved' ? Colors.success : t.status === 'in_progress' ? Colors.warning : Colors.primary }]}>
                {t.status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))
        )}

        {/* FAQ */}
        <Text style={styles.section}>FAQs</Text>
        {FAQS.map((f, i) => (
          <View key={i} style={styles.faqCard}>
            <TouchableOpacity
              style={styles.faqHead}
              onPress={() => setOpen(open === i ? null : i)}
              testID={`faq-${i}`}
            >
              <Text style={styles.faqQ}>{f.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            {open === i && <Text style={styles.faqA}>{f.a}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  emergency: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.xl, padding: 14, ...Shadows.card },
  emergencyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { ...Typography.bodyBold, color: '#991B1B' },
  emergencySub: { ...Typography.small, color: '#B91C1C', marginTop: 2 },
  emergencyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  contactCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, ...Shadows.card },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { ...Typography.bodyBold, color: Colors.textPrimary, marginTop: 8 },
  contactSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 8, ...Shadows.card },
  ticketDot: { width: 8, height: 8, borderRadius: 4 },
  ticketTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  ticketSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  ticketStatus: { ...Typography.caption, fontWeight: '700' as const, textTransform: 'capitalize' },
  faqCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 8 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  faqA: { ...Typography.body, color: Colors.textSecondary, marginTop: 8, lineHeight: 22 },
  empty: { ...Typography.small, color: Colors.textTertiary, textAlign: 'center', padding: 16 },
});
