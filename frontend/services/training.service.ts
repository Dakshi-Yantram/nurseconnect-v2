/**
 * Training & assessments — /api/training/* and /api/assessments/*.
 *
 * Three audiences share this file:
 *   - workers                 : browse published modules, take assessments
 *   - clinical trainers       : author module/assessment drafts, submit them
 *                               for review, record practical (Gate 3) sign-offs
 *   - clinical training leads : approve / reject / publish, review attempts
 *
 * Two path quirks worth remembering, both taken from the backend router setup:
 *   - training *module* lifecycle actions are on /training/{id}/...
 *   - *assessment* lifecycle actions are on their own router, /assessments/{id}/...
 *   - the module quiz submit takes a BARE array body, while the standalone
 *     assessment submit takes { answers: [...] }.
 */
import { api } from '../lib/api';

export type ContentStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'published';

export type AssessmentQuestionType = 'single_select' | 'multi_select' | 'boolean' | 'text';

// ---------------------------------------------------------------------------
// Training modules — worker view
// ---------------------------------------------------------------------------
export interface TrainingModuleListItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  video_url: string | null;
  is_mandatory: boolean;
  completed: boolean;
  passed: boolean | null;
  certificate_url: string | null;
}

export interface ModuleQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number | null;
  explanation: string;
  difficulty: number;
  type: AssessmentQuestionType;
}

export interface TrainingModuleDetail {
  id: string;
  code: string;
  title: string;
  description: string | null;
  content_url: string | null;
  video_url: string | null;
  duration_minutes: number;
  pass_percent: number;
  assessment: ModuleQuestion[];
}

export interface AssessmentSubmitResult {
  score: number;
  passed: boolean;
  certificate_url?: string | null;
  attempts?: number;
  pass_score?: number;
  qualification_unlocked?: string[];
}

// ---------------------------------------------------------------------------
// Training modules — author / reviewer view
// ---------------------------------------------------------------------------
export interface TrainingModuleAdmin {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  video_url: string | null;
  content_url: string | null;
  pass_percent: number;
  is_mandatory: boolean;
  is_active: boolean;
  version: number;
  status: ContentStatus | null;
  required_for_tiers: string[];
  assessment: Record<string, any>[];
  created_by?: string | null;
  updated_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  published_version?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TrainingModuleDraft {
  code: string;
  title: string;
  description?: string;
  category?: string;
  duration_minutes?: number;
  required_for_tiers?: string[];
  content_url?: string;
  video_url?: string;
  assessment?: Record<string, any>[];
  pass_percent?: number;
  is_mandatory?: boolean;
}

export type TrainingModuleUpdate = Partial<Omit<TrainingModuleDraft, 'code'>>;

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------
export interface AssessmentQuestion {
  question_id?: string;
  id?: string;
  type?: AssessmentQuestionType;
  text?: string;
  question?: string;
  options?: string[];
  difficulty?: string | number;
  correct_index?: number;
  correct_indices?: number[];
  correct_bool?: boolean;
  variants?: Record<string, any>[];
  [k: string]: any;
}

export interface AssessmentOut {
  id: string;
  code: string;
  title: string;
  description: string | null;
  version: number;
  pass_score: number;
  questions: AssessmentQuestion[];
  linked_training_module_code: string | null;
  status: ContentStatus | null;
  is_active: boolean;
  randomize_options: boolean;
  questions_per_attempt: number;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  cooldown_hours: number | null;
  // Worker-list extras
  attempted?: boolean;
  latest_score?: number | null;
  latest_passed?: boolean | null;
  latest_submitted_at?: string | null;
  can_start?: boolean;
  locked_reason?: string | null;
  attempts_used?: number;
  // Author / reviewer extras
  review_notes?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

export interface AssessmentDraft {
  code: string;
  title: string;
  description?: string;
  pass_score?: number;
  questions: AssessmentQuestion[];
  linked_training_module_code?: string;
}

export type AssessmentUpdate = Partial<Omit<AssessmentDraft, 'code'>>;

// ---------------------------------------------------------------------------
// Secure assessment session — one question at a time, state held server-side
// ---------------------------------------------------------------------------
export interface SessionQuestion {
  question_number: number;
  total_questions: number;
  question_id: string;
  type: AssessmentQuestionType;
  text: string;
  /** Already shuffled server-side — answer with the index as displayed. */
  options: string[];
  difficulty: string | number | null;
}

export interface SessionStart {
  session_id: string;
  expires_at: string | null;
  question: SessionQuestion;
}

export type SessionAnswerResult =
  | { finished: false; correct: boolean; question: SessionQuestion }
  | {
      finished: true;
      correct: boolean;
      score: number;
      passed: boolean;
      pass_score: number;
      qualification_unlocked: string[];
    };

// ---------------------------------------------------------------------------
// Gate 3 — practical sign-off
// ---------------------------------------------------------------------------
export interface PracticalTarget {
  target_type: 'service' | 'package';
  target_id: string;
  name: string;
  checklist_items: string[];
}

export interface WorkerSearchResult {
  worker_id: string;
  full_name: string | null;
  phone_e164: string | null;
  tier: string | null;
}

export interface PracticalSignOff {
  id: string;
  worker_id: string;
  target_type: 'service' | 'package';
  target_id: string;
  target_name: string | null;
  checklist_responses: Record<string, boolean>;
  passed: boolean;
  notes: string | null;
  signed_by: string;
  signer_name: string | null;
  signed_at: string;
}

export interface AttemptRow {
  attempt_id: string;
  assessment_id: string;
  assessment_code: string | null;
  worker_id: string;
  worker_name: string | null;
  score: number;
  passed: boolean;
  submitted_at: string | null;
}

export const trainingService = {
  // ----- Worker: learning -----
  list: () => api.get<TrainingModuleListItem[]>('/training/modules'),
  get: (moduleId: string) => api.get<TrainingModuleDetail>(`/training/modules/${moduleId}`),
  /**
   * Legacy quiz attached to a training module. The endpoint takes a bare list
   * body (not `{ answers }`) — either `[0, 2, 1]` or `[{ id, answer }]`.
   */
  submitModuleAssessment: (moduleId: string, answers: any[]) =>
    api.post<AssessmentSubmitResult>(`/training/modules/${moduleId}/assessment/submit`, answers),

  // ----- Worker: standalone assessments -----
  listAssessments: () => api.get<AssessmentOut[]>('/training/assessments'),
  getAssessment: (assessmentId: string) =>
    api.get<AssessmentOut>(`/training/assessments/${assessmentId}`),
  /** One-shot submit. Wraps answers, unlike the module quiz above. */
  submitAssessment: (assessmentId: string, answers: any[]) =>
    api.post<AssessmentSubmitResult>(`/training/assessments/${assessmentId}/submit`, { answers }),

  // ----- Worker: secure session -----
  /** Resumes an unexpired in-progress session instead of starting a new one. */
  startSession: (assessmentId: string) =>
    api.post<SessionStart>(`/training/assessments/${assessmentId}/start`),
  answerSession: (assessmentId: string, sessionId: string, answer: any) =>
    api.post<SessionAnswerResult>(
      `/training/assessments/${assessmentId}/sessions/${sessionId}/answer`,
      { answer },
    ),

  // ----- Trainer: module authoring -----
  createModuleDraft: (payload: TrainingModuleDraft) =>
    api.post<TrainingModuleAdmin>('/training/modules', payload),
  updateModuleDraft: (moduleId: string, payload: TrainingModuleUpdate) =>
    api.put<TrainingModuleAdmin>(`/training/modules/${moduleId}`, payload),
  listModulesAdmin: (status?: ContentStatus) =>
    api.get<TrainingModuleAdmin[]>(
      '/training/admin/modules',
      status ? { params: { status } } : undefined,
    ),
  getModuleAdmin: (moduleId: string) =>
    api.get<TrainingModuleAdmin>(`/training/admin/modules/${moduleId}`),

  // ----- Module lifecycle (on the /training router) -----
  submitModuleForReview: (moduleId: string, notes?: string) =>
    api.post<TrainingModuleAdmin>(`/training/${moduleId}/submit-review`, { notes }),
  approveModule: (moduleId: string, notes?: string) =>
    api.post<TrainingModuleAdmin>(`/training/${moduleId}/approve`, { notes }),
  rejectModule: (moduleId: string, notes?: string) =>
    api.post<TrainingModuleAdmin>(`/training/${moduleId}/reject`, { notes }),
  publishModule: (moduleId: string, notes?: string) =>
    api.post<TrainingModuleAdmin>(`/training/${moduleId}/publish`, { notes }),

  // ----- Trainer: assessment authoring -----
  createAssessmentDraft: (payload: AssessmentDraft) =>
    api.post<AssessmentOut>('/training/assessments', payload),
  updateAssessmentDraft: (assessmentId: string, payload: AssessmentUpdate) =>
    api.put<AssessmentOut>(`/training/assessments/${assessmentId}`, payload),
  listAssessmentsAdmin: (status?: ContentStatus) =>
    api.get<AssessmentOut[]>(
      '/training/admin/assessments',
      status ? { params: { status } } : undefined,
    ),
  getAssessmentAdmin: (assessmentId: string) =>
    api.get<AssessmentOut>(`/training/admin/assessments/${assessmentId}`),

  // ----- Assessment lifecycle (separate /assessments router) -----
  submitAssessmentForReview: (assessmentId: string, notes?: string) =>
    api.post<AssessmentOut>(`/assessments/${assessmentId}/submit-review`, { notes }),
  approveAssessment: (assessmentId: string, notes?: string) =>
    api.post<AssessmentOut>(`/assessments/${assessmentId}/approve`, { notes }),
  rejectAssessment: (assessmentId: string, notes?: string) =>
    api.post<AssessmentOut>(`/assessments/${assessmentId}/reject`, { notes }),
  publishAssessment: (assessmentId: string, notes?: string) =>
    api.post<AssessmentOut>(`/assessments/${assessmentId}/publish`, { notes }),

  // ----- Clinical training lead: attempt review -----
  listAttempts: (filters?: { assessment_id?: string; worker_id?: string; passed?: boolean }) =>
    api.get<AttemptRow[]>('/training/reviewer/attempts', filters ? { params: filters } : undefined),

  // ----- Gate 3: practical sign-off -----
  practicalTargets: () => api.get<PracticalTarget[]>('/training/practical-targets'),
  searchWorkers: (q: string) =>
    api.get<WorkerSearchResult[]>('/training/workers/search', { params: { q } }),
  createPracticalSignOff: (payload: {
    worker_id: string;
    target_type: 'service' | 'package';
    target_id: string;
    checklist_responses: Record<string, boolean>;
    passed: boolean;
    notes?: string;
  }) => api.post<PracticalSignOff>('/training/practical-signoff', payload),
  listPracticalSignOffs: (workerId?: string) =>
    api.get<PracticalSignOff[]>(
      '/training/practical-signoff',
      workerId ? { params: { worker_id: workerId } } : undefined,
    ),
};
