import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { NurseCard } from '../components/NurseCard';
import { EmptyState } from '../components/EmptyState';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { NURSES } from '../mock-data/nurses';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'top', label: 'Top rated' },
  { key: 'near', label: 'Nearest' },
] as const;

export default function NursesList() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const list = useMemo(() => {
    let r = NURSES.filter((n) =>
      [n.name, ...n.specializations].join(' ').toLowerCase().includes(query.toLowerCase())
    );
    if (filter === 'female') r = r.filter((n) => n.gender === 'Female');
    if (filter === 'male') r = r.filter((n) => n.gender === 'Male');
    if (filter === 'top') r = [...r].sort((a, b) => b.rating - a.rating);
    if (filter === 'near') r = [...r].sort((a, b) => a.distanceKm - b.distanceKm);
    return r;
  }, [query, filter]);

  return (
    <SafeAreaView style={styles.safe} testID="nurses-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Available Nurses" subtitle={`${list.length} nearby`} />
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: 8 }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search by name or care…" />
        <View style={styles.filters}>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(f) => f.key}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setFilter(item.key)}
                style={[styles.chip, filter === item.key && styles.chipActive]}
                testID={`filter-${item.key}`}
              >
                <Text
                  style={[styles.chipTxt, filter === item.key && { color: '#fff' }]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {list.length === 0 ? (
        <EmptyState
          title="No nurses match"
          description="Try changing your filters or search query"
          icon="search-outline"
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <NurseCard
              nurse={item}
              onPress={() => router.push({ pathname: '/nurse/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  filters: { marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600' as const },
});
