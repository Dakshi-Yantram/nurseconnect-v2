import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
// SafeAreaView reused for sticky bar bottom inset
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { NURSES, REVIEWS } from '../../mock-data/nurses';
import { GradientButton } from '../../components/GradientButton';
import { Header } from '../../components/Header';
import { useStore } from '../../store';

export default function NurseProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nurse = NURSES.find((n) => n.id === id) || NURSES[0];
  const reviews = REVIEWS[nurse.id] || [];
  const draft = useStore((s) => s.draftBooking);
  const setDraft = useStore((s) => s.setDraftBooking);

  const goBook = () => {
    setDraft({
      ...(draft || {}),
      nurseId: nurse.id,
      nurseName: nurse.name,
      nurseAvatar: nurse.avatar,
    });
    router.push('/booking');
  };

  return (
    <SafeAreaView style={styles.safe} testID="nurse-profile" edges={['top']}>
      <Header title="Nurse Profile" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: nurse.avatar }} style={styles.avatar} />
          <View style={styles.verifiedPill}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.verifiedTxt}>Verified by NurseConnect</Text>
          </View>
          <Text style={styles.name}>{nurse.name}</Text>
          <Text style={styles.role}>
            {nurse.gender} · {nurse.experienceYears} yrs experience
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <FontAwesome5 name="star" size={14} color={Colors.accent} solid />
              <Text style={styles.statVal}>{nurse.rating}</Text>
              <Text style={styles.statLab}>{nurse.reviews} reviews</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.statVal}>{nurse.distanceKm} km</Text>
              <Text style={styles.statLab}>Distance</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="cash" size={14} color={Colors.success} />
              <Text style={styles.statVal}>₹{nurse.hourlyRate}</Text>
              <Text style={styles.statLab}>per hour</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.about}>{nurse.about}</Text>
        </View>

        {/* Specializations */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.tags}>
            {nurse.specializations.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagTxt}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Certifications */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          {nurse.certifications.map((c) => (
            <View key={c} style={styles.certRow}>
              <Ionicons name="ribbon-outline" size={16} color={Colors.primary} />
              <Text style={styles.certTxt}>{c}</Text>
            </View>
          ))}
          <Text style={styles.langs}>Languages: {nurse.languages.join(', ')}</Text>
        </View>

        {/* Reviews */}
        <View style={styles.card}>
          <View style={styles.reviewHead}>
            <Text style={styles.sectionTitle}>Patient reviews</Text>
            <Text style={styles.reviewCount}>{reviews.length} reviews</Text>
          </View>
          {reviews.map((r) => (
            <View key={r.id} style={styles.review}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewer}>{r.author}</Text>
                <View style={styles.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FontAwesome5
                      key={i}
                      name="star"
                      size={10}
                      color={i < r.rating ? Colors.accent : Colors.border}
                      solid
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewTxt}>{r.text}</Text>
              <Text style={styles.reviewDate}>{r.date}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceLabel}>Starting at</Text>
          <Text style={styles.price}>
            ₹{nurse.hourlyRate}
            <Text style={styles.priceUnit}>/hr</Text>
          </Text>
        </View>
        <GradientButton
          title={nurse.available ? 'Book Slot' : 'Notify when free'}
          onPress={goBook}
          fullWidth={false}
          style={{ paddingHorizontal: 28 }}
          testID="book-slot-btn"
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { alignItems: 'center', padding: Spacing.lg },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.surface,
    ...Shadows.card,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 4,
    marginTop: -14,
  },
  verifiedTxt: { ...Typography.caption, color: '#fff', fontSize: 9 },
  name: { ...Typography.h2, color: Colors.textPrimary, marginTop: 12 },
  role: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { ...Typography.bodyBold, color: Colors.textPrimary, fontWeight: '800' as const },
  statLab: { ...Typography.caption, color: Colors.textTertiary },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: 12,
    padding: Spacing.card,
    borderRadius: Radius.xl,
    ...Shadows.card,
  },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 8 },
  about: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  tagTxt: { ...Typography.small, color: Colors.primary, fontWeight: '600' as const },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  certTxt: { ...Typography.body, color: Colors.textPrimary },
  langs: { ...Typography.small, color: Colors.textSecondary, marginTop: 12 },
  reviewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCount: { ...Typography.small, color: Colors.textTertiary },
  review: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { ...Typography.bodyBold, color: Colors.textPrimary },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewTxt: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
  reviewDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 12,
  },
  priceLabel: { ...Typography.caption, color: Colors.textTertiary },
  price: { ...Typography.h3, color: Colors.primary, fontWeight: '800' as const, marginTop: 2 },
  priceUnit: { ...Typography.small, color: Colors.textTertiary, fontWeight: '500' as const },
});
