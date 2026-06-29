import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';

export default function Training() {
  const router = useRouter();
  const courses = useStore((s) => s.courses);
  const [tab, setTab] = useState<'courses' | 'certs'>('courses');

  const completed = courses.filter((c) => c.status === 'completed').length;
  const inProgress = courses.filter((c) => c.status === 'in_progress').length;

  return (
    <SafeAreaView style={styles.safe} testID="training-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Training" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <LinearGradient colors={Gradients.teal as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>Continuous learning</Text>
          <Text style={styles.heroVal}>{completed} / {courses.length} courses completed</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroBox}>
              <Text style={styles.heroNum}>{completed}</Text>
              <Text style={styles.heroLab}>Completed</Text>
            </View>
            <View style={styles.heroBox}>
              <Text style={styles.heroNum}>{inProgress}</Text>
              <Text style={styles.heroLab}>In progress</Text>
            </View>
            <View style={styles.heroBox}>
              <Text style={styles.heroNum}>3</Text>
              <Text style={styles.heroLab}>Certificates</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setTab('courses')}
            style={[styles.tab, tab === 'courses' && styles.tabActive]}
            testID="tab-courses"
          >
            <Text style={[styles.tabTxt, tab === 'courses' && { color: Colors.primary }]}>Courses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('certs')}
            style={[styles.tab, tab === 'certs' && styles.tabActive]}
            testID="tab-certs"
          >
            <Text style={[styles.tabTxt, tab === 'certs' && { color: Colors.primary }]}>Certificates</Text>
          </TouchableOpacity>
        </View>

        {tab === 'courses' ? (
          courses.map((c) => {
            const pct = Math.round((c.completed / c.modules) * 100);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.courseCard}
                onPress={() => router.push({ pathname: '/training/[id]', params: { id: c.id } })}
                testID={`course-${c.id}`}
              >
                <Image source={{ uri: c.thumbnail }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.row}>
                    <View style={styles.catChip}>
                      <Text style={styles.catChipTxt}>{c.category}</Text>
                    </View>
                    {c.status === 'completed' && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    )}
                  </View>
                  <Text style={styles.courseTitle} numberOfLines={2}>{c.title}</Text>
                  <Text style={styles.courseSub}>{c.modules} modules · {c.durationMins} mins</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.coursePct}>{pct}% complete</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <TouchableOpacity onPress={() => router.push('/certificates')} style={styles.linkCard} testID="view-all-certs">
            <View style={styles.linkIcon}>
              <FontAwesome5 name="award" size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.linkTitle}>Your certificates</Text>
              <Text style={styles.linkSub}>3 active · 1 expiring soon · download anytime</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { borderRadius: Radius.xl, padding: 20, ...Shadows.floating },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroVal: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', padding: 10, borderRadius: Radius.md },
  heroNum: { ...Typography.h3, color: '#fff', fontWeight: '800' as const },
  heroLab: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: 4, marginVertical: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  courseCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 12, marginBottom: 12, ...Shadows.card },
  thumb: { width: 80, height: 80, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChip: { backgroundColor: Colors.infoBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  catChipTxt: { ...Typography.caption, color: Colors.primary, fontSize: 9 },
  courseTitle: { ...Typography.bodyBold, color: Colors.textPrimary, marginTop: 4 },
  courseSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  track: { height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 3, marginTop: 8 },
  fill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  coursePct: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  linkCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, ...Shadows.card },
  linkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  linkSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
