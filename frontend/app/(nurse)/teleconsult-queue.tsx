/**
 * Doctor's teleconsultation queue. Doctor-only (WorkerType.doctor). Each
 * booking moves forward through fixed stages, in order, never backward:
 * waiting -> diet_review -> patient_assessment -> prescription -> completed.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { teleconsultService, TeleConsultOut, TeleConsultStage } from '../../services/teleconsult.service';

const STAGE_LABEL: Record<TeleConsultStage, string> = {
  waiting: 'Waiting',
  diet_review: 'Diet review',
  patient_assessment: 'Patient assessment',
  prescription: 'Ready for e-Rx',
  completed: 'Completed',
};

const STAGE_COLOR: Record<TeleConsultStage, string> = {
  waiting: Colors.textTertiary,
  diet_review: Colors.warning,
  patient_assessment: Colors.info,
  prescription: Colors.accent,
  completed: Colors.success,
};

function ConsultRow({ item, onAdvanced }: { item: TeleConsultOut; onAdvanced: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [dietNotes, setDietNotes] = useState(item.diet_notes ?? '');
  const [allOkay, setAllOkay] = useState(true);
  const [issues, setIssues] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitDiet = async () => {
    if (!dietNotes.trim()) {
      Alert.alert('Add diet notes', 'Diet notes are required to move this consultation forward.');
      return;
    }
    setSubmitting(true);
    try {
      await teleconsultService.submitDiet(item.id, dietNotes.trim());
      onAdvanced();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPatientIssues = async () => {
    if (!allOkay && !issues.trim()) {
      Alert.alert('Add details', 'Describe the issue, or mark the patient as all okay.');
      return;
    }
    setSubmitting(true);
    try {
      await teleconsultService.submitPatientIssues(item.id, allOkay, issues.trim());
      onAdvanced();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName}>{item.patient_name ?? 'Patient'}</Text>
          <View style={[styles.stagePill, { backgroundColor: `${STAGE_COLOR[item.stage]}20` }]}>
            <Text style={[styles.stagePillText, { color: STAGE_COLOR[item.stage] }]}>
              {STAGE_LABEL[item.stage]}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {(item.stage === 'waiting' || item.stage === 'diet_review') && (
            <>
              <Text style={styles.fieldLabel}>Diet notes</Text>
              <TextInput
                style={styles.textArea}
                multiline
                value={dietNotes}
                onChangeText={setDietNotes}
                placeholder="What the patient should eat / avoid..."
                placeholderTextColor={Colors.textTertiary}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={submitDiet} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Save & continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {item.stage === 'patient_assessment' && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Patient is all okay</Text>
                <Switch value={allOkay} onValueChange={setAllOkay} trackColor={{ true: Colors.success }} />
              </View>
              {!allOkay && (
                <TextInput
                  style={styles.textArea}
                  multiline
                  value={issues}
                  onChangeText={setIssues}
                  placeholder="Describe what was flagged..."
                  placeholderTextColor={Colors.textTertiary}
                />
              )}
              <TouchableOpacity style={styles.primaryButton} onPress={submitPatientIssues} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Save & continue</Text>}
              </TouchableOpacity>
            </>
          )}

          {item.stage === 'prescription' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push({
                  pathname: '/(nurse)/write-eprescription',
                  params: { consultId: item.id, bookingId: item.booking_id },
                })
              }
            >
              <MaterialCommunityIcons name="file-sign" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Write e-prescription</Text>
            </TouchableOpacity>
          )}

          {item.stage === 'completed' && (
            <Text style={styles.doneText}>Consultation complete — e-prescription issued.</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function TeleconsultQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<TeleConsultOut[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await teleconsultService.myQueue();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Could not load queue', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const active = items.filter((i) => i.stage !== 'completed');
  const completed = items.filter((i) => i.stage === 'completed');

  return (
    <SafeAreaView style={styles.safe} testID="teleconsult-queue-screen" edges={['top']}>
      <Header title="Teleconsult Queue" />
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
            />
          }
        >
          {active.length === 0 && completed.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="stethoscope" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No consultations in your queue yet</Text>
            </View>
          )}
          {active.map((item) => (
            <ConsultRow key={item.id} item={item} onAdvanced={() => load(true)} />
          ))}
          {completed.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Completed</Text>
              {completed.map((item) => (
                <ConsultRow key={item.id} item={item} onAdvanced={() => load(true)} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  sectionLabel: { ...Typography.small, color: Colors.textTertiary, marginTop: Spacing.md, marginBottom: Spacing.sm, textTransform: 'uppercase', fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl * 2 },
  emptyText: { marginTop: Spacing.sm, color: Colors.textTertiary, fontSize: 13 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.card },
  patientName: { ...Typography.bodyBold, color: Colors.textPrimary },
  stagePill: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  stagePillText: { fontSize: 11, fontWeight: '700' },
  cardBody: { paddingHorizontal: Spacing.card, paddingBottom: Spacing.card, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.md },
  fieldLabel: { ...Typography.small, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  primaryButton: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  doneText: { color: Colors.success, fontSize: 13, fontWeight: '600' },
});
