import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useStore } from '../../store';

export default function NurseDashboard() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const assignments = useStore((s) => s.assignments);
  const newRequests = useStore((s) => s.newRequests);
  const kit = useStore((s) => s.kit);
  const earnings = useStore((s) => s.earnings);
  const bootstrapNurse = useStore((s) => s.bootstrapNurse);

  // Bootstrap nurse data on every focus (lightweight: parallel allSettled)
  useFocusEffect(
    React.useCallback(() => {
      bootstrapNurse().catch(() => {});
    }, [bootstrapNurse])
  );

  const today = assignments.filter((a) => {
    const d = new Date(a.date);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  });
  const completedThisMonth = assignments.filter((a) => a.status === 'completed').length;
  const earningsMonth = earnings
    ? Math.round(Number(earnings.total_paid || 0) + Number(earnings.total_pending || 0))
    : assignments.reduce((s, a) => s + a.netCost, 0);
  const kitDone = kit.filter((k) => k.checked).length;
  const kitTotal = Math.max(kit.length, 1);
  const kitPct = Math.round((kitDone / kitTotal) * 100);

  return (
    <SafeAreaView style={styles.safe} testID="nurse-dashboard" edges={['top']}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetRow}>
          <Image
            source={{
              uri:
                user?.avatar ||
                'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80',
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.hello}>Hi, {user?.name?.split(' ')[0] || 'Nurse'}</Text>
            <Text style={styles.subHello}>Ready for today’s visits</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Earnings hero */}
        <LinearGradient
          colors={Gradients.teal as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>This month’s earnings</Text>
          <Text style={styles.heroValue}>₹{earningsMonth.toLocaleString('en-IN')}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroBox}>
              <Text style={styles.heroBoxNum}>{today.length}</Text>
              <Text style={styles.heroBoxLab}>Today</Text>
            </View>
            <View style={styles.heroBox}>
              <Text style={styles.heroBoxNum}>{completedThisMonth}</Text>
              <Text style={styles.heroBoxLab}>Completed</Text>
            </View>
            <View style={styles.heroBox}>
              <Text style={styles.heroBoxNum}>4.9</Text>
              <Text style={styles.heroBoxLab}>Rating ★</Text>
            </View>
          </View>
        </LinearGradient>

        {/* New requests */}
        {newRequests.length > 0 && (
          <View style={styles.requestCard}>
            <View style={styles.requestHead}>
              <View style={[styles.iconBubble, { backgroundColor: Colors.warningBg }]}>
                <MaterialCommunityIcons name="bell-ring" size={18} color={Colors.warning} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.requestTitle}>
                  {newRequests.length} new request{newRequests.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.requestSub}>Tap to review and accept</Text>
              </View>
              <TouchableOpacity
                style={styles.requestBtn}
                onPress={() => router.push('/(nurse)/assignments')}
                testID="view-requests-btn"
              >
                <Text style={styles.requestBtnTxt}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Today schedule */}
        <View style={styles.row}>
          <Text style={styles.section}>Today’s schedule</Text>
          <TouchableOpacity onPress={() => router.push('/(nurse)/assignments')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {today.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-check" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTxt}>No visits scheduled today</Text>
          </View>
        ) : (
          today.slice(0, 3).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.assignRow}
              onPress={() =>
                router.push({ pathname: '/nurse-visit/[id]', params: { id: a.id } })
              }
              testID={`assignment-${a.id}`}
            >
              <View style={styles.timeChip}>
                <Text style={styles.timeChipTxt}>{a.slot}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.assignTitle} numberOfLines={1}>
                  {a.careTitle}
                </Text>
                <Text style={styles.assignSub} numberOfLines={1}>
                  {a.address}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}

        {/* Kit checklist preview */}
        <Text style={styles.section}>Your kit checklist</Text>
        <TouchableOpacity
          style={styles.kitCard}
          onPress={() => router.push('/(nurse)/kit')}
          testID="kit-preview"
        >
          <View style={styles.kitHead}>
            <Text style={styles.kitTitle}>Daily preparation</Text>
            <Text style={[styles.kitPct, { color: kitPct >= 80 ? Colors.success : Colors.warning }]}>
              {kitPct}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${kitPct}%` }]} />
          </View>
          <Text style={styles.kitSub}>
            {kitDone} of {kitTotal} essential items ready
          </Text>
        </TouchableOpacity>

        {/* Quick actions */}
        <Text style={styles.section}>Quick actions</Text>
        <View style={styles.qaRow}>
          <TouchableOpacity
            style={styles.qaBox}
            onPress={() => router.push('/earnings')}
            testID="quick-earnings"
          >
            <View style={[styles.qaIcon, { backgroundColor: Colors.successBg }]}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color={Colors.success} />
            </View>
            <Text style={styles.qaLabel}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBox} onPress={() => router.push('/(nurse)/kit')}>
            <View style={[styles.qaIcon, { backgroundColor: Colors.warningBg }]}>
              <MaterialCommunityIcons name="medical-bag" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.qaLabel}>Kit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBox} onPress={() => router.push('/training')} testID="quick-training">
            <View style={[styles.qaIcon, { backgroundColor: Colors.infoBg }]}>
              <MaterialCommunityIcons name="school" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.qaLabel}>Training</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qaBox}
            onPress={() => router.push('/certificates')}
            testID="quick-certificates"
          >
            <View style={[styles.qaIcon, { backgroundColor: Colors.errorBg }]}>
              <Ionicons name="ribbon" size={20} color={Colors.error} />
            </View>
            <Text style={styles.qaLabel}>Certificates</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  greetRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  hello: { ...Typography.h3, color: Colors.textPrimary },
  subHello: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  hero: { marginHorizontal: Spacing.lg, borderRadius: Radius.xl, padding: 20, ...Shadows.floating },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...Typography.h1, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', padding: 12, borderRadius: Radius.md },
  heroBoxNum: { ...Typography.h3, color: '#fff', fontWeight: '800' as const },
  heroBoxLab: { ...Typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  requestCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    marginBottom: 0,
    padding: 14,
    borderRadius: Radius.lg,
    ...Shadows.card,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  requestHead: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  requestTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  requestSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  requestBtn: { backgroundColor: Colors.warning, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  requestBtnTxt: { ...Typography.small, color: '#fff', fontWeight: '700' as const },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: 24,
  },
  section: { ...Typography.h3, color: Colors.textPrimary, marginHorizontal: Spacing.lg, marginTop: 24, marginBottom: 12 },
  seeAll: { ...Typography.small, color: Colors.teal, fontWeight: '700' as const },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: 24,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  emptyTxt: { ...Typography.body, color: Colors.textTertiary, marginTop: 8 },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: 8,
    padding: 14,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  timeChip: { backgroundColor: Colors.infoBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md },
  timeChipTxt: { ...Typography.small, color: Colors.primary, fontWeight: '700' as const },
  assignTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  assignSub: { ...Typography.small, color: Colors.textTertiary, marginTop: 2 },
  kitCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    padding: 16,
    borderRadius: Radius.xl,
    ...Shadows.card,
  },
  kitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  kitTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  kitPct: { ...Typography.h4, fontWeight: '800' as const },
  progressTrack: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: Colors.success, borderRadius: 4 },
  kitSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 8 },
  qaRow: { flexDirection: 'row', paddingHorizontal: Spacing.md },
  qaBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, alignItems: 'center', margin: 4, ...Shadows.card },
  qaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const, marginTop: 8, textAlign: 'center' },
});
