import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { GradientButton } from '../components/GradientButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, Radius, Shadows, Spacing, Typography } from '../constants/theme';
import { FAMILY_MEMBERS } from '../mock-data/family';

export default function FamilyMembers() {
  return (
    <SafeAreaView style={styles.safe} testID="family-members-screen" edges={['top']}>
      <OfflineBanner />
      <Header title="Family Members" />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.intro}>
          Add family members to easily book care for them and track their care history
        </Text>
        {FAMILY_MEMBERS.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.sub}>
                {m.relation} · {m.age} years
              </Text>
              {m.conditions && m.conditions.length > 0 && (
                <View style={styles.tags}>
                  {m.conditions.map((c) => (
                    <View key={c} style={styles.tag}>
                      <Text style={styles.tagTxt}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity testID={`edit-${m.id}`}>
              <Ionicons name="pencil" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ marginTop: 24 }}>
          <GradientButton title="+ Add family member" variant="outline" testID="add-member-btn" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  intro: { ...Typography.body, color: Colors.textSecondary, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 12,
    ...Shadows.card,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  sub: { ...Typography.small, color: Colors.textSecondary, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { backgroundColor: Colors.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  tagTxt: { ...Typography.caption, color: Colors.accentDark, fontSize: 9 },
});
