import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/Header';
import { ChecklistItem } from '../../components/ChecklistItem';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function Kit() {
  const kit = useStore((s) => s.kit);
  const toggleKitAPI = useStore((s) => s.toggleKitAPI);
  const loadKitAPI = useStore((s) => s.loadKitAPI);

  useEffect(() => {
    loadKitAPI().catch(() => {});
  }, [loadKitAPI]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof kit> = {};
    kit.forEach((k) => {
      if (!g[k.category]) g[k.category] = [];
      g[k.category].push(k);
    });
    return g;
  }, [kit]);

  const done = kit.filter((k) => k.checked).length;
  const total = kit.length;
  const pct = Math.round((done / total) * 100);
  const missing = kit.filter((k) => !k.checked && k.required);

  return (
    <SafeAreaView style={styles.safe} testID="kit-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Kit Checklist" showBack fallbackHref="/(nurse)/dashboard" rightIcon="refresh-outline" onRightPress={() => Alert.alert('Synced', 'Kit inventory updated from warehouse')} />

      {/* Sticky progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHead}>
          <Text style={styles.progressTitle}>Daily preparation</Text>
          <Text style={[styles.progressPct, { color: pct >= 80 ? Colors.success : Colors.warning }]}>
            {pct}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct >= 80 ? Colors.success : Colors.warning }]} />
        </View>
        <Text style={styles.progressSub}>
          {done} of {total} items ready · {missing.length} required items missing
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat} style={styles.section}>
            <Text style={styles.catTitle}>{cat}</Text>
            {items.map((item) => (
              <ChecklistItem key={item.id} item={item} onToggle={() => toggleKitAPI(item.id)} />
            ))}
          </View>
        ))}
        {missing.length > 0 && (
          <GradientButton
            title={`Request ${missing.length} missing item${missing.length > 1 ? 's' : ''}`}
            variant="accent"
            onPress={() => Alert.alert('Request sent', 'Stock team will deliver missing items')}
            testID="request-missing-btn"
            style={{ marginTop: 16 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  progressCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    marginBottom: 0,
    padding: 16,
    borderRadius: Radius.xl,
    ...Shadows.card,
  },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  progressPct: { ...Typography.h3, fontWeight: '800' as const },
  track: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4 },
  progressSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 8 },
  section: { marginTop: 16 },
  catTitle: { ...Typography.caption, color: Colors.textTertiary, marginBottom: 8 },
});
