import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { CarePackageCard } from '../components/CarePackageCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Spacing, Typography } from '../constants/theme';
import { CARE_TYPES } from '../constants/careTypes';
import { useStore } from '../store';

export default function CareTypes() {
  const router = useRouter();
  const setDraft = useStore((s) => s.setDraftBooking);

  const choose = (id: string, title: string, baseRate: number) => {
    setDraft({ careTypeId: id, careTitle: title, cost: baseRate });
    router.push({ pathname: '/nurses', params: { care: id } });
  };

  return (
    <SafeAreaView style={styles.safe} testID="care-types-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="What care do you need?" />
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}>
        <Text style={styles.intro}>
          Select a care category and we’ll show you verified nurses near you
        </Text>
        <View style={styles.grid}>
          {CARE_TYPES.map((c, i) => (
            <View key={c.id} style={{ width: '50%' }}>
              <CarePackageCard
                care={c}
                onPress={() => choose(c.id, c.title, c.baseRate)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: { ...Typography.body, color: Colors.textSecondary, marginHorizontal: 6, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
