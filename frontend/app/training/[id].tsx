import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courses = useStore((s) => s.courses);
  const advance = useStore((s) => s.advanceCourse);
  const c = courses.find((x) => x.id === id) || courses[0];

  if (!c) return null;
  const pct = Math.round((c.completed / c.modules) * 100);

  return (
    <SafeAreaView style={styles.safe} testID="course-detail" edges={['top']}>
      <OfflineBanner />
      <Header title="Course" fallbackHref="/training" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <Image source={{ uri: c.thumbnail }} style={styles.banner} />
        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Text style={styles.chipTxt}>{c.category}</Text>
          </View>
          <Text style={styles.dur}>{c.durationMins} mins · {c.modules} modules</Text>
        </View>
        <Text style={styles.title}>{c.title}</Text>

        <View style={styles.progressCard}>
          <View style={styles.row}>
            <Text style={styles.progressLab}>Your progress</Text>
            <Text style={[styles.progressPct, { color: pct === 100 ? Colors.success : Colors.primary }]}>{pct}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct === 100 ? Colors.success : Colors.primary }]} />
          </View>
          <Text style={styles.progressSub}>{c.completed} of {c.modules} modules completed</Text>
        </View>

        <Text style={styles.sec}>Modules</Text>
        {Array.from({ length: c.modules }).map((_, i) => {
          const done = i < c.completed;
          return (
            <View key={i} style={styles.module}>
              <View style={[styles.modIcon, { backgroundColor: done ? Colors.successBg : Colors.surfaceAlt }]}>
                {done ? (
                  <Ionicons name="checkmark" size={16} color={Colors.success} />
                ) : (
                  <Text style={styles.modNum}>{i + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modTitle}>Module {i + 1}: {['Introduction', 'Core concepts', 'Hands-on practice', 'Case studies', 'Advanced topics', 'Final assessment', 'Bonus material', 'Reflection'][i] || 'Lesson'}</Text>
                <Text style={styles.modSub}>{Math.round(c.durationMins / c.modules)} mins · {done ? 'Completed' : 'Pending'}</Text>
              </View>
            </View>
          );
        })}

        {pct < 100 ? (
          <GradientButton
            title={`Continue · Module ${c.completed + 1}`}
            onPress={() => {
              advance(c.id);
              if (c.completed + 1 >= c.modules) {
                Alert.alert('Course completed!', 'A new certificate has been issued. Check Training → Certificates.');
              }
            }}
            testID="continue-course"
            style={{ marginTop: 16 }}
          />
        ) : (
          <GradientButton
            title="Download certificate"
            variant="accent"
            onPress={() => Alert.alert('Certificate downloaded', 'Saved to your device')}
            testID="download-cert"
            style={{ marginTop: 16 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  banner: { width: '100%', height: 180, borderRadius: Radius.xl, backgroundColor: Colors.surfaceAlt },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  chip: { backgroundColor: Colors.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  chipTxt: { ...Typography.caption, color: Colors.primary, fontSize: 10 },
  dur: { ...Typography.small, color: Colors.textSecondary },
  title: { ...Typography.h2, color: Colors.textPrimary, marginTop: 8 },
  progressCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginTop: 16, ...Shadows.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLab: { ...Typography.bodyBold, color: Colors.textPrimary },
  progressPct: { ...Typography.h3, fontWeight: '800' as const },
  track: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4 },
  progressSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 8 },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  module: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: Radius.lg, marginBottom: 6 },
  modIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modNum: { ...Typography.bodyBold, color: Colors.textTertiary },
  modTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  modSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
});
