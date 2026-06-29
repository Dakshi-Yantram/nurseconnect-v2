import { api } from '../lib/api';

/* ============================================================
   Backend-aligned types (mirror /app/backend/app/schemas/schemas.py)
   ============================================================ */

export interface VisitRecordOut {
  id: string;
  booking_id: string;
  worker_id: string;
  patient_id: string;
  status: 'scheduled' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  en_route_at: string | null;
  arrived_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  actual_duration_minutes: number | null;
  checklist_responses: Record<string, any> | null;
  documentation_responses: Record<string, any> | null;
  documentation_complete: boolean;
  family_summary: string | null;
  care_notes: string | null;
  photo_urls: string[] | null;
  rating_by_consumer: number | null;
  rating_comment: string | null;
  escalation_triggered: boolean;
  created_at: string;
}

export interface VitalSignsSubmit {
  bp_systolic?: number;
  bp_diastolic?: number;
  pulse?: number;
  spo2?: number;
  temperature_f?: number | string;
  respiratory_rate?: number;
  blood_sugar_fasting?: number | string;
  blood_sugar_random?: number | string;
  weight_kg?: number | string;
  pain_score?: number;
  gcs_score?: number;
  measurement_device?: string;
  recorded_at?: string;
  is_offline_submitted?: boolean;
}

export interface VitalSignsOut extends Required<Pick<VitalSignsSubmit, 'bp_systolic' | 'bp_diastolic' | 'pulse' | 'spo2'>> {
  id: string;
  visit_record_id: string;
  patient_id: string;
  temperature_f: string | null;
  respiratory_rate: number | null;
  blood_sugar_fasting: string | null;
  blood_sugar_random: string | null;
  weight_kg: string | null;
  pain_score: number | null;
  gcs_score: number | null;
  abnormal_flags: string[] | null;
  escalation_triggered: boolean;
  escalation_level: 'none' | 'watch' | 'inform_family' | 'contact_doctor' | 'emergency';
  recorded_at: string;
}

export interface MedicationSubmit {
  drug_name: string;
  drug_generic_name?: string;
  drug_class?: string;
  dose_amount: string;
  dose_unit?: string;
  route?: 'oral' | 'iv' | 'im' | 'sc' | 'topical' | 'inhalation' | 'sublingual' | 'rectal' | 'other';
  site?: string;
  prescription_id?: string;
  allergy_check_done?: boolean;
  allergy_confirmed_clear?: boolean;
  patient_identified?: boolean;
  expiry_checked?: boolean;
  administered_at: string; // ISO datetime — required
  patient_response?: string;
  adverse_reaction?: boolean;
  adverse_reaction_notes?: string;
  batch_number?: string;
  manufacturer?: string;
  is_offline_submitted?: boolean;
}

export interface CheckInPayload {
  latitude: number;
  longitude: number;
}

export interface CheckOutPayload {
  latitude: number;
  longitude: number;
  family_summary?: string;
  care_notes?: string;
}

export interface ChecklistResponses {
  responses: Record<string, any>;
  is_offline_submitted?: boolean;
}

export interface RatingPayload {
  rating: number;
  comment?: string;
}

export const visitsService = {
  get: (bookingId: string) => api.get<VisitRecordOut>(`/visits/${bookingId}`),
  checkin: (bookingId: string, lat: number, lng: number) =>
    api.post<VisitRecordOut>(`/visits/${bookingId}/checkin`, { latitude: lat, longitude: lng }),
  checkout: (
    bookingId: string,
    payload: { latitude?: number; longitude?: number; family_summary?: string; care_notes?: string }
  ) =>
    api.post<VisitRecordOut>(`/visits/${bookingId}/checkout`, {
      latitude: payload.latitude ?? 0,
      longitude: payload.longitude ?? 0,
      family_summary: payload.family_summary,
      care_notes: payload.care_notes,
    }),
  submitVitals: (bookingId: string, v: VitalSignsSubmit) =>
    api.post<VitalSignsOut>(`/visits/${bookingId}/vitals`, v),
  vitalsList: (bookingId: string) => api.get<VitalSignsOut[]>(`/visits/${bookingId}/vitals`),
  logMedication: (bookingId: string, m: MedicationSubmit) =>
    api.post<{ id: string; escalation_triggered: boolean }>(`/visits/${bookingId}/medications`, m),
  submitChecklist: (bookingId: string, responses: Record<string, any>, isOfflineSubmitted = false) =>
    api.post<VisitRecordOut>(`/visits/${bookingId}/checklist`, {
      responses,
      is_offline_submitted: isOfflineSubmitted,
    }),
  submitRating: (bookingId: string, rating: number, comment?: string) =>
    api.post<VisitRecordOut>(`/visits/${bookingId}/rating`, { rating, comment }),
};

/* ============================================================
   Care notes (separate router /care-notes)
   ============================================================ */

export interface CareNoteOut {
  id: string;
  patient_id: string;
  booking_id: string | null;
  visit_record_id: string | null;
  author_id: string;
  author_role: string;
  title: string | null;
  content: string;
  note_type: string;
  visible_to_family: boolean;
  visible_to_worker: boolean;
  created_at: string;
}

export const careNotesService = {
  create: (payload: {
    patient_id: string;
    booking_id?: string;
    title?: string;
    content: string;
    note_type?: string;
    visible_to_family?: boolean;
    visible_to_worker?: boolean;
  }) => api.post<CareNoteOut>(`/care-notes/`, payload),
  listForPatient: (patientId: string) => api.get<CareNoteOut[]>(`/care-notes/patient/${patientId}`),
};
