import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function AbhaRecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const records = useStore((s) => s.abhaRecords);
  const r = records.find((x) => x.id === id) || records[0];

  if (!r) return null;

  return (
    <SafeAreaView style={styles.safe} testID="abha-record-detail" edges={['top']}>
      <OfflineBanner />
      <Header title={r.type} fallbackHref="/abha" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
        <View style={styles.card}>
          <View style={styles.iconHero}>
            <MaterialCommunityIcons name="file-document-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{r.type}</Text>
          <Text style={styles.sub}>{r.hospital}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.secTitle}>Details</Text>
          <View style={styles.kv}><Text style={styles.k}>Doctor</Text><Text style={styles.v}>{r.doctor}</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Date</Text><Text style={styles.v}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Category</Text><Text style={styles.v}>{r.category}</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Size</Text><Text style={styles.v}>{r.fileSize}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.secTitle}>Summary</Text>
          <Text style={styles.body}>{r.summary}</Text>
        </View>

        <GradientButton
          title="Download record"
          onPress={() => Alert.alert('Download started', `${r.type} will be saved to your device`)}
          testID="abha-download-btn"
          style={{ marginTop: 16 }}
          icon={<Ionicons name="download-outline" size={18} color="#fff" />}
        />
        <GradientButton
          title="Share with nurse"
          variant="outline"
          onPress={() => Alert.alert('Shared', 'Record shared with your assigned nurse')}
          testID="abha-share-btn"
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 20, alignItems: 'center', ...Shadows.card },
  iconHero: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: Colors.textPrimary, marginTop: 12, textAlign: 'center' },
  sub: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  section: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, marginTop: 12, ...Shadows.card },
  secTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { ...Typography.body, color: Colors.textSecondary },
  v: { ...Typography.bodyBold, color: Colors.textPrimary, textTransform: 'capitalize' },
  body: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
});
