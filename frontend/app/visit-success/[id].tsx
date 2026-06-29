import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useStore } from '../../store';

export default function VisitSuccess() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const careNotes = useStore((s) => s.careNotes);
  const note = id ? careNotes[id] : undefined;

  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    // Auto-redirect to Nurse Visits home (Past tab) after 3.5s if user does nothing
    const t = setTimeout(() => {
      router.replace({ pathname: '/(nurse)/assignments', params: { tab: 'past' } });
    }, 3500);
    return () => clearTimeout(t);
  }, [scale, router]);

  return (
    <SafeAreaView style={styles.safe} testID="visit-success-screen">
      <LinearGradient
        colors={Gradients.successCard as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Animated.View style={[styles.checkWrap, { transform: [{ scale }] }]}>
          <Ionicons name="checkmark" size={56} color={Colors.success} />
        </Animated.View>
        <Text style={styles.title}>Visit completed!</Text>
        <Text style={styles.sub}>Care notes saved & shared with the family</Text>
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick summary</Text>
        {note?.vitals ? (
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>BP</Text>
              <Text style={styles.cellValue}>{note.vitals.bp}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Pulse</Text>
              <Text style={styles.cellValue}>{note.vitals.pulse} bpm</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>SpO₂</Text>
              <Text style={styles.cellValue}>{note.vitals.spo2}%</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Temp</Text>
              <Text style={styles.cellValue}>{note.vitals.temp} °F</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.body}>Care delivered successfully. Vitals recorded.</Text>
        )}

        <View style={styles.notifyBox}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.notifyTxt}>Family notified · Admin notified · Earnings credited</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <GradientButton
          title="View care notes"
          onPress={() =>
            router.replace({ pathname: '/nurse-visit/[id]', params: { id: id || '' } })
          }
          testID="success-view-notes"
          icon={<Ionicons name="document-text-outline" size={18} color="#fff" />}
        />
        <GradientButton
          title="Back to visits"
          variant="outline"
          onPress={() =>
            router.replace({ pathname: '/(nurse)/assignments', params: { tab: 'past' } })
          }
          testID="success-back-visits"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  hero: { padding: 32, alignItems: 'center', paddingTop: 64, paddingBottom: 56 },
  checkWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  title: { ...Typography.h1, color: '#fff', marginTop: 24, fontWeight: '800' as const },
  sub: { ...Typography.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.xl,
    padding: 18,
    ...Shadows.card,
    marginTop: -28,
  },
  cardTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 12 },
  body: { ...Typography.body, color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceAlt,
    padding: 12,
    borderRadius: Radius.md,
  },
  cellLabel: { ...Typography.caption, color: Colors.textTertiary },
  cellValue: { ...Typography.h4, color: Colors.textPrimary, fontWeight: '800' as const, marginTop: 4 },
  notifyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    padding: 10,
    borderRadius: Radius.md,
    marginTop: 12,
  },
  notifyTxt: { ...Typography.small, color: Colors.success, flex: 1 },
  actions: { padding: Spacing.lg, gap: 10 },
});
