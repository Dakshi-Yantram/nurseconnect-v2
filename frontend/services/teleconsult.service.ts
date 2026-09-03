/**
 * Teledoctor consultation queue — /api/teleconsult/*.
 *
 * A doctor's booking moves forward through fixed stages, in order, and
 * never backward: waiting -> diet_review -> patient_assessment ->
 * prescription -> completed. This file covers the doctor's own queue; the
 * admin cross-doctor view lives in the web dashboard.
 */
import { api } from '../lib/api';

export type TeleConsultStage =
  | 'waiting'
  | 'diet_review'
  | 'patient_assessment'
  | 'prescription'
  | 'completed';

export interface TeleConsultOut {
  id: string;
  booking_id: string;
  doctor_worker_id: string;
  patient_id: string;
  patient_name: string | null;
  stage: TeleConsultStage;
  diet_notes: string | null;
  patient_issues: string | null;
  patient_all_okay: boolean | null;
  prescription_id: string | null;
  created_at: string;
}

export const teleconsultService = {
  /** Called when the doctor's call for a booking starts. Idempotent — returns the existing queue item if one already exists. */
  start: (bookingId: string) =>
    api.post<TeleConsultOut>('/teleconsult/start', { booking_id: bookingId }).then((r) => r.data),

  myQueue: (stage?: TeleConsultStage) =>
    api
      .get<TeleConsultOut[]>('/teleconsult/queue', { params: stage ? { stage } : undefined })
      .then((r) => r.data),

  /** Advances waiting/diet_review -> patient_assessment. */
  submitDiet: (id: string, dietNotes: string) =>
    api.patch<TeleConsultOut>(`/teleconsult/${id}/diet`, { diet_notes: dietNotes }).then((r) => r.data),

  /** Advances patient_assessment -> prescription. Omit `issues` (or pass allOkay=true) when nothing was flagged. */
  submitPatientIssues: (id: string, allOkay: boolean, issues?: string) =>
    api
      .patch<TeleConsultOut>(`/teleconsult/${id}/patient-issues`, {
        all_okay: allOkay,
        issues: allOkay ? null : issues,
      })
      .then((r) => r.data),

  /** Marks the consultation completed — the backend requires an e-Rx already linked. */
  complete: (id: string) => api.patch<TeleConsultOut>(`/teleconsult/${id}/complete`, {}).then((r) => r.data),
};
