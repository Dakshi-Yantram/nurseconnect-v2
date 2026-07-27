/**
 * Training modules published to this care professional.
 *
 * Completion here is what feeds the qualification gate, so mandatory modules
 * are called out — an outstanding mandatory module can be the reason a nurse
 * can't take on a care package.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { trainingService, type TrainingModuleListItem } from '../services/training.service';
import { formatDuration } from '../lib/format';

export default function Training() {
  const router = useRouter();
  const [modules, setModules] = useState<TrainingModuleListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setModules(await trainingService.list());
    } catch (e: any) {
      setError(e?.message || 'Could not load training modules');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { completed, mandatoryOutstanding } = useMemo(
    () => ({
      completed: modules.filter((m) => m.completed).length,
      mandatoryOutstanding: modules.filter((m) => m.is_mandatory && !m.completed).length,
    }),
    [modules],
  );

  return (
    <SafeAreaView style={styles.safe} testID="training-screen" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Training"
        fallbackHref="/(nurse)/profile"
        rightIcon="ribbon-outline"
        onRightPress={() => router.push('/certificates')}
      />

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <LinearGradient
          colors={Gradients.teal as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Your progress</Text>
          <Text style={styles.heroVal}>
            {completed} of {modules.length} module{modules.length === 1 ? '' : 's'} completed
          </Text>
          {mandatoryOutstanding > 0 && (
            <View style={styles.heroWarn}>
              <Ionicons name="alert-circle" size={13} color="#fff" />
              <Text style={styles.heroWarnTxt}>
                {mandatoryOutstanding} mandatory module{mandatoryOutstanding === 1 ? '' : 's'}{' '}
                outstanding
              </Text>
            </View>
          )}
        </LinearGradient>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => router.push('/assessments')}
          testID="training-assessments"
        >
          <View style={styles.linkIcon}>
            <Ionicons name="clipboard" size={20} color={Colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Assessments</Text>
            <Text style={styles.linkSub}>Tests that unlock care packages</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <Text style={styles.section}>Modules</Text>

        <AsyncBoundary
          state={{ loading: !loaded, loaded, error: error || null }}
          isEmpty={modules.length === 0}
          emptyTitle="No modules published yet"
          emptyDescription="Training modules appear here once your clinical training team publishes them."
          emptyIcon="school-outline"
          onRetry={load}
        >
          {modules.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/training/[id]', params: { id: m.id } })}
              testID={`module-${m.id}`}
            >
              <View
                style={[
                  styles.cardIcon,
                  { backgroundColor: m.completed ? Colors.successBg : '#CCFBF1' },
                ]}
              >
                <Ionicons
                  name={m.completed ? 'checkmark-circle' : 'play-circle'}
                  size={22}
                  color={m.completed ? Colors.success : Colors.teal}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {[m.category, formatDuration(m.duration_minutes)].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.tagRow}>
                  {m.is_mandatory && (
                    <View style={[styles.tag, { backgroundColor: Colors.warningBg }]}>
                      <Text style={[styles.tagTxt, { color: Colors.warning }]}>Mandatory</Text>
                    </View>
                  )}
                  {m.completed && (
                    <View style={[styles.tag, { backgroundColor: Colors.successBg }]}>
                      <Text style={[styles.tagTxt, { color: Colors.success }]}>
                        {m.passed === false ? 'Completed — quiz not passed' : 'Completed'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </AsyncBoundary>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.floating },
  heroLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroVal: { ...Typography.h3, color: '#fff', fontWeight: '800' as const, marginTop: 4 },
  heroWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  heroWarnTxt: { ...Typography.caption, color: '#fff', fontWeight: '600' as const },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  linkSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  section: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.card,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  cardSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  tagTxt: { ...Typography.caption, fontWeight: '700' as const },
});
