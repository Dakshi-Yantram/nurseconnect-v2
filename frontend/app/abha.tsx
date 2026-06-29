import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/Header';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { useStore } from '../store';
import { ABHACategory } from '../types';

const CAT_LABELS: Record<ABHACategory, { label: string; icon: any; color: string }> = {
  discharge: { label: 'Discharge', icon: 'file-document-outline', color: Colors.primary },
  lab: { label: 'Lab report', icon: 'test-tube', color: Colors.success },
  prescription: { label: 'Prescription', icon: 'pill', color: Colors.warning },
  radiology: { label: 'Radiology', icon: 'radioactive-circle-outline', color: Colors.error },
};

export default function ABHAScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const records = useStore((s) => s.abhaRecords);
  const [filter, setFilter] = useState<'all' | ABHACategory>('all');

  const filtered = filter === 'all' ? records : records.filter((r) => r.category === filter);

  return (
    <SafeAreaView style={styles.safe} testID="abha-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="ABHA & Health Records" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.row}>
            <Ionicons name="shield-checkmark" size={24} color="#fff" />
            <Text style={styles.brand}>ABHA · Ayushman Bharat Health Account</Text>
          </View>
          <Text style={styles.id}>{user?.abhaId || '14-1234-5678-9012'}</Text>
          <Text style={styles.addr}>aarav@abha</Text>
          <View style={styles.qrPlaceholder}>
            <Ionicons name="qr-code" size={48} color="#fff" />
            <Text style={styles.qrTxt}>Show QR at hospitals</Text>
          </View>
        </LinearGradient>

        <View style={styles.row2}>
          <Text style={styles.section}>Linked Records ({records.length})</Text>
          <TouchableOpacity
            style={styles.linkBtnSmall}
            onPress={() => router.push('/abha/link')}
            testID="link-record-btn"
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.linkBtnSmallTxt}>Link new</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          data={[{ k: 'all', label: 'All' }, ...Object.entries(CAT_LABELS).map(([k, v]) => ({ k, label: v.label }))]}
          keyExtractor={(c) => c.k}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item.k as any)}
              style={[styles.chip, filter === item.k && styles.chipActive]}
              testID={`abha-filter-${item.k}`}
            >
              <Text style={[styles.chipTxt, filter === item.k && { color: '#fff' }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {filtered.map((r) => {
          const meta = CAT_LABELS[r.category];
          return (
            <TouchableOpacity
              key={r.id}
              style={styles.recordRow}
              onPress={() => router.push({ pathname: '/abha/[id]', params: { id: r.id } })}
              testID={`abha-record-${r.id}`}
            >
              <View style={[styles.recordIcon, { backgroundColor: meta.color + '15' }]}>
                <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.recordTitle} numberOfLines={1}>{r.type}</Text>
                <Text style={styles.recordSub}>
                  {r.hospital} · {r.doctor}
                </Text>
                <Text style={styles.recordDate}>
                  {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {r.fileSize}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: { borderRadius: Radius.xl, padding: 20, ...Shadows.floating },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { ...Typography.bodyBold, color: '#fff', flex: 1 },
  id: { ...Typography.h2, color: '#fff', fontWeight: '800' as const, marginTop: 16, letterSpacing: 1 },
  addr: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  qrPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    borderRadius: Radius.md,
    marginTop: 16,
  },
  qrTxt: { ...Typography.bodyBold, color: '#fff' },
  section: { ...Typography.h3, color: Colors.textPrimary, marginTop: 24 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  linkBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, gap: 4, marginTop: 24 },
  linkBtnSmallTxt: { ...Typography.small, color: '#fff', fontWeight: '700' as const },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface, borderRadius: Radius.pill, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    ...Shadows.card,
  },
  recordIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recordTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  recordSub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  recordDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
});
