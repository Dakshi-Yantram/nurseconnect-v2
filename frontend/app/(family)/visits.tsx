import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../components/Header';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function VisitsScreen() {
  const router = useRouter();
  const bookings = useStore((s) => s.bookings);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const filtered = bookings.filter((b) =>
    tab === 'upcoming'
      ? b.status === 'scheduled' || b.status === 'enroute' || b.status === 'active'
      : b.status === 'completed' || b.status === 'cancelled'
  );

  return (
    <SafeAreaView style={styles.safe} testID="visits-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="My Visits" showBack={false} />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => setTab('upcoming')}
          testID="tab-upcoming"
        >
          <Text style={[styles.tabTxt, tab === 'upcoming' && styles.tabTxtActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
          testID="tab-past"
        >
          <Text style={[styles.tabTxt, tab === 'past' && styles.tabTxtActive]}>Past</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming visits' : 'No past visits yet'}
          description={
            tab === 'upcoming'
              ? 'Book your first nurse visit and we’ll keep you posted.'
              : 'Your completed visits will appear here.'
          }
          icon="calendar-outline"
          ctaTitle={tab === 'upcoming' ? 'Book a Nurse' : undefined}
          onCtaPress={() => router.push('/care-types')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              showActions={tab === 'upcoming'}
              onPress={() =>
                item.status === 'enroute' || item.status === 'active'
                  ? router.push({ pathname: '/tracking/[id]', params: { id: item.id } })
                  : router.push({ pathname: '/visit/[id]', params: { id: item.id } })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginVertical: 8,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.surface },
  tabTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
  tabTxtActive: { color: Colors.primary },
});
