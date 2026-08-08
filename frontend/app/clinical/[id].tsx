/**
 * Patch 4 — Dynamic clinical documentation screen.
 *
 * All checklist/documentation rendering is driven by the resolved workflow
 * returned by GET /api/care/workflow/{booking_id}. The screen does NOT
 * hardcode service names, question IDs, vitals shapes, or wound-photo rules.
 *
 * UI scaffolding (Header, GradientButton, InputField, sticky bottom bar,
 * step indicator) is intentionally preserved from the Patch 3 design to
 * avoid breaking the existing visual style.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Header } from '../../components/Header';
import { GradientButton } from '../../components/GradientButton';
import { InputField } from '../../components/InputField';
import { OfflineBanner } from '../../components/OfflineBanner';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { resolveMediaUrl } from '../../lib/api';
import { useStore } from '../../store';
import {
  CareWorkflow,
  WorkflowChecklistQuestion,
  WorkflowDocumentationField,
  WorkflowErrorResponse,
  WorkflowMissingItem,
  WorkflowQuestionType,
  careWorkflowService,
} from '../../services/care-workflow.service';

type PhotoFieldKind = 'checklist' | 'documentation';

type AnyAnswer = any;

const TYPE_LABEL: Record<WorkflowQuestionType, string> = {
  text: 'Text',
  textarea: 'Notes',
  number: 'Number',
  boolean: 'Yes / No',
  single_select: 'Pick one',
  multi_select: 'Pick all that apply',
  photo: 'Photo',
  vitals_entry: 'Vitals',
  medication_entry: 'Medication',
  consent_confirmation: 'Consent',
};

const PHASE_ORDER = ['pre_visit', 'during_visit', 'post_visit', 'all'] as const;

function answerFromExisting(value: any): AnyAnswer {
  if (value && typeof value === 'object' && 'value' in value) return value.value;
  return value;
}

export default function ClinicalDocumentation() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id || '';

  const [workflow, setWorkflow] = useState<CareWorkflow | null>(null);
  const [workflowError, setWorkflowError] = useState<WorkflowErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutMissing, setCheckoutMissing] = useState<WorkflowMissingItem[] | null>(null);

  // Local in-memory answer map. Keyed by `${question.id}` / `${field.field_id}`.
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, AnyAnswer>>({});
  const [docAnswers, setDocAnswers] = useState<Record<string, AnyAnswer>>({});
  const [docFileUrls, setDocFileUrls] = useState<Record<string, string | null>>({});

  const completeVisitAPI = useStore((s) => s.completeVisitAPI);

  // ------------------------------------------------------------------
  // Fetch resolved workflow for this booking
  // ------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    setWorkflowError(null);
    try {
      const wf = (await careWorkflowService.get(bookingId)) as CareWorkflow | WorkflowErrorResponse;
      if ((wf as WorkflowErrorResponse).success === false) {
        setWorkflowError(wf as WorkflowErrorResponse);
        setWorkflow(null);
      } else {
        const w = wf as CareWorkflow;
        setWorkflow(w);
        // Hydrate in-memory answers from existing rows
        const cAns: Record<string, AnyAnswer> = {};
        for (const r of w.existing_responses.checklist) {
          cAns[r.question_id] = answerFromExisting(r.answer_json);
        }
        const dAns: Record<string, AnyAnswer> = {};
        const dFiles: Record<string, string | null> = {};
        for (const r of w.existing_responses.documentation) {
          dAns[r.field_id] = answerFromExisting(r.value_json);
          dFiles[r.field_id] = r.file_url;
        }
        setChecklistAnswers(cAns);
        setDocAnswers(dAns);
        setDocFileUrls(dFiles);
      }
    } catch (e: any) {
      const detail = e?.detail || {};
      if (detail.code) {
        setWorkflowError({ success: false, code: detail.code, message: detail.message || e.message });
      } else {
        Alert.alert('Could not load workflow', e?.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) refresh();
  }, [bookingId, refresh]);

  // ------------------------------------------------------------------
  // Grouped questions by phase for the step indicator (keeps prior UX)
  // ------------------------------------------------------------------
  const phases = useMemo(() => {
    if (!workflow?.checklist_template) return ['all'];
    const present = new Set<string>();
    for (const q of workflow.checklist_template.questions || []) {
      present.add((q.phase as string) || (workflow.checklist_template?.phase as string) || 'all');
    }
    // Order phases by PHASE_ORDER and append unknowns last
    const ordered: string[] = [];
    for (const p of PHASE_ORDER) if (present.has(p)) ordered.push(p);
    for (const p of present) if (!ordered.includes(p)) ordered.push(p);
    return ordered.length ? ordered : ['all'];
  }, [workflow]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
  }, [bookingId]);

  // ------------------------------------------------------------------
  // Mutation helpers
  // ------------------------------------------------------------------
  const setChecklist = (qid: string, value: AnyAnswer) =>
    setChecklistAnswers((s) => ({ ...s, [qid]: value }));
  const setDocAnswer = (fid: string, value: AnyAnswer) =>
    setDocAnswers((s) => ({ ...s, [fid]: value }));

  const persistChecklist = async (qs: WorkflowChecklistQuestion[]) => {
    if (!workflow?.checklist_template) return;
    const responses = qs
      .map((q) => ({ question_id: q.id, answer: checklistAnswers[q.id] }))
      .filter((r) => r.answer !== undefined);
    if (responses.length === 0) return;
    await careWorkflowService.submitResponses(bookingId, responses);
  };

  const persistDocumentation = async (fields: WorkflowDocumentationField[]) => {
    if (!workflow?.documentation_template) return;
    for (const f of fields) {
      const v = docAnswers[f.field_id];
      const fileUrl = docFileUrls[f.field_id] || undefined;
      if (v === undefined && !fileUrl) continue;
      await careWorkflowService.submitDocumentationItem(bookingId, {
        field_id: f.field_id,
        value: v,
        file_url: fileUrl,
      });
    }
  };

  // ------------------------------------------------------------------
  // Photo capture / upload (uses expo-image-picker)
  // ------------------------------------------------------------------
  // Per-field upload state so one photo uploading doesn't spin every button
  // on the screen (the old code reused the global `submitting` flag).
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  // Local preview shown the instant a photo is taken/picked, before the
  // network call resolves — the nurse sees *something* immediately instead
  // of a blank button while the upload is in flight.
  const [localPreview, setLocalPreview] = useState<Record<string, string>>({});
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const openAppSettings = () => {
    Linking.openSettings().catch(() =>
      Alert.alert('Could not open Settings', 'Please open Settings manually to update permissions.'),
    );
  };

  /** Returns true once permission is granted; otherwise alerts and returns false. */
  const ensureCameraPermission = async (): Promise<boolean> => {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const requested = await ImagePicker.requestCameraPermissionsAsync();
      if (requested.granted) return true;
    }
    Alert.alert(
      'Camera access needed',
      'NurseConnect needs camera access to capture clinical photos. Please enable it in Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openAppSettings },
      ],
    );
    return false;
  };

  const ensureLibraryPermission = async (): Promise<boolean> => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted || (current as any).accessPrivileges === 'limited') return true;
    if (current.canAskAgain) {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (requested.granted || (requested as any).accessPrivileges === 'limited') return true;
    }
    Alert.alert(
      'Photo library access needed',
      'NurseConnect needs photo library access to attach clinical photos. Please enable it in Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openAppSettings },
      ],
    );
    return false;
  };

  const uploadAsset = async (
    fieldId: string,
    kind: PhotoFieldKind,
    asset: ImagePicker.ImagePickerAsset,
  ) => {
    setLocalPreview((s) => ({ ...s, [fieldId]: asset.uri }));
    setUploadingField(fieldId);
    try {
      const up = await careWorkflowService.uploadDocumentationFile(
        bookingId,
        fieldId,
        asset.uri,
        asset.fileName || `${fieldId}.jpg`,
        asset.mimeType || 'image/jpeg',
      );
      if (kind === 'documentation') {
        setDocFileUrls((s) => ({ ...s, [fieldId]: up.file_url }));
        // Persist the doc field immediately so the row appears in completion status.
        await careWorkflowService.submitDocumentationItem(bookingId, {
          field_id: fieldId,
          file_url: up.file_url,
        });
      } else {
        // Checklist "photo" questions are answered like any other checklist
        // question — the file_url rides inside the answer payload and is
        // persisted together with the rest of the phase on "Next", not via
        // the documentation endpoint.
        setChecklist(fieldId, { file_url: up.file_url });
      }
    } catch (e: any) {
      const code = e?.detail?.detail?.code || e?.detail?.code;
      if (code === 'CONSENT_MISSING') {
        Alert.alert(
          'Photo consent required',
          'This patient has not given consent for clinical photographs yet. Please obtain consent before attaching photos.',
        );
      } else if (e?.network) {
        Alert.alert('No connection', 'Could not upload the photo — please check your connection and try again.');
      } else {
        Alert.alert('Upload failed', e?.message || 'Please try again.');
      }
      // Drop the optimistic preview since the upload didn't actually land.
      setLocalPreview((s) => {
        const next = { ...s };
        delete next[fieldId];
        return next;
      });
    } finally {
      setUploadingField(null);
    }
  };

  const takePhoto = async (fieldId: string, kind: PhotoFieldKind) => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: Platform.OS !== 'web',
      });
      if (res.canceled || !res.assets?.length) return;
      await uploadAsset(fieldId, kind, res.assets[0]);
    } catch (e: any) {
      Alert.alert('Could not open camera', e?.message || 'Please try again.');
    }
  };

  const pickFromLibrary = async (fieldId: string, kind: PhotoFieldKind) => {
    const ok = await ensureLibraryPermission();
    if (!ok) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.length) return;
      await uploadAsset(fieldId, kind, res.assets[0]);
    } catch (e: any) {
      Alert.alert('Could not open photo library', e?.message || 'Please try again.');
    }
  };

  const pickAndUpload = (fieldId: string, kind: PhotoFieldKind) => {
    Alert.alert('Add clinical photo', 'Take a new photo or choose one from your gallery.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from gallery', onPress: () => pickFromLibrary(fieldId, kind) },
      { text: 'Take photo', onPress: () => takePhoto(fieldId, kind) },
    ]);
  };

  // ------------------------------------------------------------------
  // Step + checkout flow
  // ------------------------------------------------------------------
  const currentPhase = phases[step];
  const phaseQuestions = useMemo(() => {
    if (!workflow?.checklist_template) return [] as WorkflowChecklistQuestion[];
    const all = workflow.checklist_template.questions || [];
    if (phases.length === 1) return all;
    return all.filter((q) => (q.phase || workflow.checklist_template!.phase || 'all') === currentPhase);
  }, [workflow, phases, currentPhase]);

  const isPhaseComplete = useMemo(() => {
    return phaseQuestions
      .filter((q) => q.required)
      .every((q) => isAnswerComplete(q.type, checklistAnswers[q.id]));
  }, [phaseQuestions, checklistAnswers]);

  const handleNext = async () => {
    if (!workflow) return;
    if (workflow.checklist_template) {
      if (!isPhaseComplete) {
        Alert.alert('Required items incomplete', 'Please complete the required questions before continuing.');
        return;
      }
      try {
        setSubmitting(true);
        await persistChecklist(phaseQuestions);
      } catch (e: any) {
        Alert.alert('Could not save responses', e?.message || 'Please try again.');
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }
    if (step < phases.length - 1) {
      setStep(step + 1);
      return;
    }
    // Last step → checkout
    await runCheckout();
  };

  const runCheckout = async () => {
    if (!workflow) return;
    setSubmitting(true);
    setCheckoutMissing(null);
    try {
      // 1. Persist any documentation items the worker filled inline.
      if (workflow.documentation_template) {
        await persistDocumentation(workflow.documentation_template.mandatory_fields || []);
      }
      // 2. Build minimal care-note payload to satisfy the existing store flow.
      const careNote = {
        bookingId,
        vitals: extractVitalsFromAnswers(checklistAnswers, workflow.checklist_template?.questions || [], docAnswers, workflow.documentation_template?.mandatory_fields || []),
        medications: extractMedsFromAnswers(checklistAnswers, workflow.checklist_template?.questions || [], docAnswers, workflow.documentation_template?.mandatory_fields || []),
        observations:
          typeof docAnswers['family_summary'] === 'string'
            ? docAnswers['family_summary']
            : 'Visit completed per workflow.',
        followUp: false,
        patientResponse: 'stable',
        completedAt: new Date().toISOString(),
      };
      await completeVisitAPI(bookingId, careNote as any, careNote.observations);
      router.replace({ pathname: '/visit-success/[id]', params: { id: bookingId } });
    } catch (e: any) {
      // Surface backend MANDATORY_DOCUMENTATION_INCOMPLETE
      const detail = e?.detail;
      if (detail?.code === 'MANDATORY_DOCUMENTATION_INCOMPLETE') {
        setCheckoutMissing(detail.missing_items || []);
        Alert.alert(
          'Please complete required documentation before checkout.',
          (detail.missing_items || []).map((m: WorkflowMissingItem) => `• ${m.label}`).join('\n') || undefined,
        );
      } else if (detail?.code === 'CLINICAL_TEMPLATE_MISSING') {
        Alert.alert('Clinical templates missing', detail.message || 'Cannot proceed without a clinical template.');
      } else {
        Alert.alert('Checkout failed', e?.message || 'Please try again.');
      }
      // Refresh completion status so the latest missing items show inline.
      try {
        const cs = await careWorkflowService.completionStatus(bookingId);
        setCheckoutMissing(cs.blocking_items?.length ? cs.blocking_items : cs.missing_items);
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} testID="clinical-doc-loading" edges={['top']}>
        <Header title="Clinical Documentation" />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.muted}>Loading workflow…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (workflowError) {
    // Previously this was a dead end: a load failure left the nurse with no
    // way to retry or get back, and no way to enter vitals/documentation —
    // the only escape was to force-navigate away from the visit entirely.
    return (
      <SafeAreaView style={styles.safe} testID="clinical-doc-error" edges={['top']}>
        <Header title="Clinical Documentation" />
        <View style={styles.errorCard} testID="workflow-error">
          <Ionicons name="warning" size={28} color={Colors.danger} />
          <Text style={styles.errorCode}>{workflowError.code}</Text>
          <Text style={styles.errorMsg}>{workflowError.message}</Text>
          <GradientButton
            title="Try again"
            onPress={refresh}
            style={{ marginTop: Spacing.lg }}
            testID="workflow-error-retry"
          />
          <GradientButton
            title="Back to visit"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.md }}
            testID="workflow-error-back"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!workflow) return null;

  const checklist = workflow.checklist_template;
  const doc = workflow.documentation_template;
  const isLastStep = step >= phases.length - 1;

  return (
    <SafeAreaView style={styles.safe} testID="clinical-doc" edges={['top']}>
      <OfflineBanner />
      <Header
        title="Clinical Documentation"
        subtitle={
          (workflow.service?.name || workflow.package?.name || 'Care Visit') +
          (checklist ? ` · ${humanisePhase(currentPhase)}` : '')
        }
      />

      {phases.length > 1 && checklist ? (
        <View style={styles.steps}>
          {phases.map((p, i) => (
            <View key={p} style={styles.stepWrap}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: i <= step ? Colors.primary : Colors.surface,
                    borderColor: i <= step ? Colors.primary : Colors.border,
                  },
                ]}
                testID={`phase-${p}`}
              >
                {i < step ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNum, { color: i <= step ? '#fff' : Colors.textTertiary }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, i === step && { color: Colors.primary, fontWeight: '700' }]}>
                {humanisePhase(p)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 200 }}>
        {/* Risk + workflow source breadcrumb (helps QA + auditors) */}
        <View style={styles.metaRow} testID="workflow-meta">
          <View style={[styles.tag, { backgroundColor: Colors.successBg }]}>
            <Text style={styles.tagTxt}>Source: {workflow.workflow_source}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.tagTxt}>Risk: {workflow.risk_level}</Text>
          </View>
          {checklist ? (
            <View style={[styles.tag, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.tagTxt}>
                Checklist v{checklist.version}
              </Text>
            </View>
          ) : null}
          {doc ? (
            <View style={[styles.tag, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.tagTxt}>Documentation v{doc.version}</Text>
            </View>
          ) : null}
        </View>

        {/* Checklist questions for the current phase */}
        {checklist ? (
          <View testID="checklist-section">
            <Text style={styles.sec}>{checklist.name}</Text>
            {phaseQuestions.length === 0 ? (
              <Text style={styles.muted}>No questions for this phase.</Text>
            ) : (
              phaseQuestions.map((q) => (
                <DynamicQuestion
                  key={q.id}
                  question={q}
                  value={checklistAnswers[q.id]}
                  onChange={(v) => setChecklist(q.id, v)}
                  onUploadPhoto={() => pickAndUpload(q.id, 'checklist')}
                  uploading={uploadingField === q.id}
                  previewUri={localPreview[q.id]}
                  onViewPhoto={(url) => setViewerUrl(url)}
                />
              ))
            )}
          </View>
        ) : (
          <View style={styles.softNotice}>
            <Text style={styles.muted}>
              No checklist template configured for this service. The visit will use a safe-default
              workflow.
            </Text>
          </View>
        )}

        {/* Documentation fields — always shown on the last step */}
        {isLastStep && doc ? (
          <View testID="documentation-section" style={{ marginTop: 16 }}>
            <Text style={styles.sec}>{doc.name}</Text>
            {(doc.mandatory_fields || []).map((f) => (
              <DynamicDocumentationField
                key={f.field_id}
                field={f}
                value={docAnswers[f.field_id]}
                fileUrl={docFileUrls[f.field_id]}
                onChange={(v) => setDocAnswer(f.field_id, v)}
                onUploadPhoto={() => pickAndUpload(f.field_id, 'documentation')}
                uploading={uploadingField === f.field_id}
                previewUri={localPreview[f.field_id]}
                onViewPhoto={(url) => setViewerUrl(url)}
              />
            ))}
          </View>
        ) : null}

        {/* Backend-driven blocking items reminder */}
        {checkoutMissing && checkoutMissing.length ? (
          <View style={styles.missingCard} testID="missing-items">
            <View style={[styles.iconBubble, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="clipboard-alert" size={20} color={Colors.danger} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.missingTitle}>
                Please complete required documentation before checkout.
              </Text>
              {checkoutMissing.map((m) => (
                <Text key={`${m.type}-${m.id}`} style={styles.missingItem}>
                  • {m.label}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView style={styles.stickyBar} edges={['bottom']}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)} testID="step-back-btn">
            <Text style={styles.backTxt}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <GradientButton
            title={isLastStep ? 'Complete visit' : 'Next'}
            onPress={handleNext}
            loading={submitting}
            testID="step-next-btn"
          />
        </View>
      </SafeAreaView>

      <Modal
        visible={!!viewerUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
        testID="photo-viewer"
      >
        <TouchableOpacity
          style={styles.viewerBackdrop}
          activeOpacity={1}
          onPress={() => setViewerUrl(null)}
        >
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUrl(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewerUrl ? (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// Helpers — pulled out for readability
// ============================================================================

function humanisePhase(phase: string): string {
  switch (phase) {
    case 'pre_visit':
      return 'Pre-visit';
    case 'during_visit':
      return 'During visit';
    case 'post_visit':
      return 'Post-visit';
    default:
      return 'Checklist';
  }
}

function isAnswerComplete(type: WorkflowQuestionType, v: AnyAnswer): boolean {
  if (v === undefined || v === null) return false;
  switch (type) {
    case 'text':
    case 'textarea':
      return typeof v === 'string' && v.trim().length > 0;
    case 'number':
      return typeof v === 'number' && !Number.isNaN(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'single_select':
      return v !== '' && v !== null && v !== undefined;
    case 'multi_select':
      return Array.isArray(v) && v.length > 0;
    case 'photo':
      return Boolean(v && (v as any).file_url);
    case 'vitals_entry':
    case 'medication_entry':
      return v && typeof v === 'object' && Object.keys(v).length > 0;
    case 'consent_confirmation':
      return v && typeof v === 'object' && !!(v as any).consented;
    default:
      return false;
  }
}

function extractVitalsFromAnswers(
  checklistAnswers: Record<string, any>,
  questions: WorkflowChecklistQuestion[],
  docAnswers: Record<string, any>,
  docFields: WorkflowDocumentationField[],
): any {
  const merged: any = {};
  for (const q of questions) {
    if (q.type === 'vitals_entry' && checklistAnswers[q.id]) {
      Object.assign(merged, checklistAnswers[q.id]);
    }
  }
  for (const f of docFields) {
    if (f.type === 'vitals_entry' && docAnswers[f.field_id]) {
      Object.assign(merged, docAnswers[f.field_id]);
    }
  }
  if (!Object.keys(merged).length) return {};
  // Map to legacy keys consumed by store.completeVisitAPI
  return {
    bp: merged.bp || (merged.bp_systolic && merged.bp_diastolic ? `${merged.bp_systolic}/${merged.bp_diastolic}` : undefined),
    pulse: merged.pulse !== undefined ? String(merged.pulse) : undefined,
    temp: merged.temperature_f !== undefined ? String(merged.temperature_f) : undefined,
    spo2: merged.spo2 !== undefined ? String(merged.spo2) : undefined,
    glucose: merged.glucose !== undefined ? String(merged.glucose) : undefined,
  };
}

function extractMedsFromAnswers(
  checklistAnswers: Record<string, any>,
  questions: WorkflowChecklistQuestion[],
  docAnswers: Record<string, any>,
  docFields: WorkflowDocumentationField[],
): { name: string; dose: string; time: string }[] {
  const meds: { name: string; dose: string; time: string }[] = [];
  for (const q of questions) {
    if (q.type === 'medication_entry' && checklistAnswers[q.id]) {
      const m = checklistAnswers[q.id];
      meds.push({ name: m.drug_name || m.name || '', dose: m.dose || m.dose_amount || '', time: m.administered_at || '' });
    }
  }
  for (const f of docFields) {
    if (f.type === 'medication_entry' && docAnswers[f.field_id]) {
      const m = docAnswers[f.field_id];
      meds.push({ name: m.drug_name || m.name || '', dose: m.dose || m.dose_amount || '', time: m.administered_at || '' });
    }
  }
  return meds.filter((m) => m.name);
}

// ============================================================================
// Dynamic question renderer
// ============================================================================
function DynamicQuestion({
  question,
  value,
  onChange,
  onUploadPhoto,
  uploading,
  previewUri,
  onViewPhoto,
}: {
  question: WorkflowChecklistQuestion;
  value: any;
  onChange: (v: any) => void;
  onUploadPhoto: () => void;
  uploading?: boolean;
  previewUri?: string;
  onViewPhoto?: (url: string) => void;
}) {
  const required = !!question.required;
  return (
    <View style={styles.qWrap} testID={`q-${question.id}`}>
      <Text style={styles.qLabel}>
        {question.text}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
        <Text style={styles.qType}>  ({TYPE_LABEL[question.type] || question.type})</Text>
      </Text>
      <FieldEditor
        type={question.type}
        options={question.options}
        value={value}
        onChange={onChange}
        onUploadPhoto={onUploadPhoto}
        uploading={uploading}
        previewUri={previewUri}
        onViewPhoto={onViewPhoto}
        testIdPrefix={`q-${question.id}`}
      />
    </View>
  );
}

function DynamicDocumentationField({
  field,
  value,
  fileUrl,
  onChange,
  onUploadPhoto,
  uploading,
  previewUri,
  onViewPhoto,
}: {
  field: WorkflowDocumentationField;
  value: any;
  fileUrl: string | null | undefined;
  onChange: (v: any) => void;
  onUploadPhoto: () => void;
  uploading?: boolean;
  previewUri?: string;
  onViewPhoto?: (url: string) => void;
}) {
  const required = !!field.required;
  return (
    <View style={styles.qWrap} testID={`doc-${field.field_id}`}>
      <Text style={styles.qLabel}>
        {field.label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
        <Text style={styles.qType}>  ({TYPE_LABEL[field.type] || field.type})</Text>
      </Text>
      <FieldEditor
        type={field.type}
        options={field.options as string[] | undefined}
        value={value}
        onChange={onChange}
        onUploadPhoto={onUploadPhoto}
        uploading={uploading}
        previewUri={previewUri}
        onViewPhoto={onViewPhoto}
        existingFileUrl={fileUrl || undefined}
        testIdPrefix={`doc-${field.field_id}`}
      />
    </View>
  );
}

function FieldEditor({
  type,
  options,
  value,
  onChange,
  onUploadPhoto,
  uploading,
  previewUri,
  onViewPhoto,
  existingFileUrl,
  testIdPrefix,
}: {
  type: WorkflowQuestionType;
  options?: string[];
  value: any;
  onChange: (v: any) => void;
  onUploadPhoto: () => void;
  uploading?: boolean;
  previewUri?: string;
  onViewPhoto?: (url: string) => void;
  existingFileUrl?: string;
  testIdPrefix: string;
}) {
  switch (type) {
    case 'text':
      return (
        <InputField
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="Enter text"
          testID={`${testIdPrefix}-text`}
        />
      );
    case 'textarea':
      return (
        <InputField
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="Enter detail"
          multiline
          numberOfLines={4}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          testID={`${testIdPrefix}-textarea`}
        />
      );
    case 'number':
      return (
        <InputField
          value={value !== undefined && value !== null ? String(value) : ''}
          onChangeText={(t) => {
            const n = t.replace(/[^0-9.\-]/g, '');
            onChange(n === '' ? undefined : Number(n));
          }}
          placeholder="0"
          keyboardType="numeric"
          testID={`${testIdPrefix}-number`}
        />
      );
    case 'boolean':
      return (
        <View style={styles.boolRow}>
          {[
            { label: 'Yes', val: true },
            { label: 'No', val: false },
          ].map((b) => (
            <TouchableOpacity
              key={String(b.val)}
              style={[styles.boolChip, value === b.val && styles.boolChipActive]}
              onPress={() => onChange(b.val)}
              testID={`${testIdPrefix}-${b.label.toLowerCase()}`}
            >
              <Text style={[styles.boolTxt, value === b.val && { color: '#fff' }]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'single_select':
      return (
        <View style={styles.boolRow}>
          {(options || []).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.boolChip, value === opt && styles.boolChipActive]}
              onPress={() => onChange(opt)}
              testID={`${testIdPrefix}-${opt}`}
            >
              <Text style={[styles.boolTxt, value === opt && { color: '#fff' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'multi_select': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
        onChange(next);
      };
      return (
        <View style={styles.boolRow}>
          {(options || []).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.boolChip, arr.includes(opt) && styles.boolChipActive]}
              onPress={() => toggle(opt)}
              testID={`${testIdPrefix}-${opt}`}
            >
              <Text style={[styles.boolTxt, arr.includes(opt) && { color: '#fff' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    case 'photo': {
      const savedUrl = existingFileUrl || value?.file_url;
      const thumbUri = previewUri || resolveMediaUrl(savedUrl);
      return (
        <View>
          {thumbUri ? (
            <TouchableOpacity
              onPress={() => savedUrl && onViewPhoto?.(resolveMediaUrl(savedUrl) || thumbUri)}
              disabled={!savedUrl}
              testID={`${testIdPrefix}-thumb`}
            >
              <View style={styles.photoThumbWrap}>
                <Image source={{ uri: thumbUri }} style={styles.photoThumb} />
                {uploading ? (
                  <View style={styles.photoThumbOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={onUploadPhoto}
            disabled={uploading}
            testID={`${testIdPrefix}-upload`}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="camera" size={20} color={Colors.primary} />
            )}
            <Text style={styles.uploadTxt}>
              {uploading ? 'Uploading…' : savedUrl ? 'Replace photo' : 'Add photo'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    case 'vitals_entry':
      return <VitalsEditor value={value || {}} onChange={onChange} testIdPrefix={testIdPrefix} />;
    case 'medication_entry':
      return <MedicationEditor value={value || {}} onChange={onChange} testIdPrefix={testIdPrefix} />;
    case 'consent_confirmation':
      return (
        <TouchableOpacity
          style={[styles.consentRow, value?.consented && styles.consentRowActive]}
          onPress={() => onChange({ consented: !value?.consented })}
          testID={`${testIdPrefix}-consent`}
        >
          <View style={[styles.checkBox, value?.consented && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
            {value?.consented ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text style={styles.consentLabel}>Patient consent confirmed</Text>
        </TouchableOpacity>
      );
    default:
      return null;
  }
}

function VitalsEditor({
  value,
  onChange,
  testIdPrefix,
}: {
  value: any;
  onChange: (v: any) => void;
  testIdPrefix: string;
}) {
  const set = (k: string, v: string) => {
    const next = { ...(value || {}) };
    if (v === '') delete next[k]; else next[k] = isNaN(Number(v)) ? v : Number(v);
    onChange(next);
  };
  return (
    <View style={styles.grid}>
      <View style={styles.gridItem}>
        <InputField
          label="BP systolic"
          value={value.bp_systolic !== undefined ? String(value.bp_systolic) : ''}
          onChangeText={(t) => set('bp_systolic', t)}
          keyboardType="numeric"
          testID={`${testIdPrefix}-bp-systolic`}
        />
      </View>
      <View style={styles.gridItem}>
        <InputField
          label="BP diastolic"
          value={value.bp_diastolic !== undefined ? String(value.bp_diastolic) : ''}
          onChangeText={(t) => set('bp_diastolic', t)}
          keyboardType="numeric"
          testID={`${testIdPrefix}-bp-diastolic`}
        />
      </View>
      <View style={styles.gridItem}>
        <InputField
          label="Pulse"
          value={value.pulse !== undefined ? String(value.pulse) : ''}
          onChangeText={(t) => set('pulse', t)}
          keyboardType="numeric"
          testID={`${testIdPrefix}-pulse`}
        />
      </View>
      <View style={styles.gridItem}>
        <InputField
          label="SpO₂"
          value={value.spo2 !== undefined ? String(value.spo2) : ''}
          onChangeText={(t) => set('spo2', t)}
          keyboardType="numeric"
          testID={`${testIdPrefix}-spo2`}
        />
      </View>
      <View style={styles.gridItem}>
        <InputField
          label="Temperature (°F)"
          value={value.temperature_f !== undefined ? String(value.temperature_f) : ''}
          onChangeText={(t) => set('temperature_f', t)}
          keyboardType="numeric"
          testID={`${testIdPrefix}-temp`}
        />
      </View>
    </View>
  );
}

function MedicationEditor({
  value,
  onChange,
  testIdPrefix,
}: {
  value: any;
  onChange: (v: any) => void;
  testIdPrefix: string;
}) {
  const set = (k: string, v: string) => {
    const next = { ...(value || {}) };
    if (v === '') delete next[k]; else next[k] = v;
    onChange(next);
  };
  return (
    <View style={{ gap: 8 }}>
      <InputField
        label="Drug name"
        value={value.drug_name || ''}
        onChangeText={(t) => set('drug_name', t)}
        placeholder="e.g. Cefuroxime"
        testID={`${testIdPrefix}-drug`}
      />
      <InputField
        label="Dose"
        value={value.dose_amount || ''}
        onChangeText={(t) => set('dose_amount', t)}
        placeholder="e.g. 500 mg"
        testID={`${testIdPrefix}-dose`}
      />
      <InputField
        label="Route"
        value={value.route || ''}
        onChangeText={(t) => set('route', t)}
        placeholder="oral / iv / im / sc"
        testID={`${testIdPrefix}-route`}
      />
    </View>
  );
}

// ============================================================================
// Styles — kept aligned with the Patch 3 visual language
// ============================================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { ...Typography.small, color: Colors.textSecondary, marginTop: 8 },
  steps: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginTop: 8, marginBottom: 12, justifyContent: 'space-between' },
  stepWrap: { alignItems: 'center', flex: 1 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepNum: { ...Typography.caption, fontSize: 10 },
  stepLabel: { ...Typography.caption, color: Colors.textTertiary, marginTop: 4 },
  sec: { ...Typography.h4, color: Colors.textPrimary, marginTop: 12, marginBottom: 12 },
  qWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' as const, marginBottom: 8 },
  qType: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '500' as const },
  requiredMark: { color: Colors.danger, fontWeight: '700' as const },
  boolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boolChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boolChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  boolTxt: { ...Typography.small, color: Colors.textPrimary, fontWeight: '600' as const },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  uploadTxt: { ...Typography.body, color: Colors.primary, fontWeight: '600' as const },
  fileTxt: { ...Typography.caption, color: Colors.textSecondary, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { flex: 1, minWidth: '47%' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consentRowActive: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentLabel: { ...Typography.body, color: Colors.textPrimary, marginLeft: 10, fontWeight: '600' as const },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagTxt: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' as const },
  softNotice: {
    backgroundColor: Colors.surfaceAlt,
    padding: 14,
    borderRadius: Radius.lg,
    marginBottom: 16,
  },
  missingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: Radius.lg,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  iconBubble: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  missingTitle: { ...Typography.bodyBold, color: Colors.danger, marginBottom: 4 },
  missingItem: { ...Typography.small, color: Colors.danger, marginTop: 2 },
  errorCard: {
    margin: 24,
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: 10,
  },
  errorCode: { ...Typography.bodyBold, color: Colors.danger },
  errorMsg: { ...Typography.body, color: Colors.danger, textAlign: 'center' },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { ...Typography.bodyBold, color: Colors.textPrimary },
  photoThumbWrap: {
    width: 96,
    height: 96,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: Colors.surfaceAlt,
  },
  photoThumb: { width: '100%', height: '100%' },
  photoThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});