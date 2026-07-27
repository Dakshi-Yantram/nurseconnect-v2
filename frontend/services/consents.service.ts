/**
 * Patient consent records — /api/consents.
 *
 * These are gates, not paperwork: the backend refuses clinical checklist
 * submission without a `service` consent and blocks photo documentation
 * without a `photo` consent, so a missing consent stops a visit mid-flow.
 * Surfacing them in the consumer app is what keeps that from happening at
 * the patient's door.
 */
import { api } from '../lib/api';

export type ConsentType =
  | 'service'
  | 'photo'
  | 'abha'
  | 'emergency'
  | 'family_proxy'
  | 'medication'
  | 'data_retention'
  | 'minor'
  | 'recording';

export type ConsentStatus = 'given' | 'revoked' | 'expired' | string;

export interface ConsentRecordOut {
  id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  given_at: string;
  expires_at: string | null;
  consented_by_name: string | null;
  relationship_to_patient: string | null;
  booking_id: string | null;
}

export const CONSENT_LABELS: Record<ConsentType, { label: string; description: string }> = {
  service: {
    label: 'Care delivery',
    description: 'Allows the assigned nurse to deliver care and record clinical notes.',
  },
  photo: {
    label: 'Clinical photographs',
    description: 'Allows wound and site photos to be captured as part of documentation.',
  },
  abha: {
    label: 'ABHA health records',
    description: 'Allows linked ABHA records to be read for this patient.',
  },
  emergency: {
    label: 'Emergency escalation',
    description: 'Allows emergency services to be contacted on the patient’s behalf.',
  },
  family_proxy: {
    label: 'Family proxy',
    description: 'Allows a family member to consent on the patient’s behalf.',
  },
  medication: {
    label: 'Medication administration',
    description: 'Allows the nurse to administer prescribed medication.',
  },
  data_retention: {
    label: 'Data retention',
    description: 'Allows visit records to be retained per the retention policy.',
  },
  minor: {
    label: 'Minor patient',
    description: 'Guardian consent for a patient under 18.',
  },
  recording: {
    label: 'Call recording',
    description: 'Allows in-app calls to be recorded for quality and safety.',
  },
};

export const consentsService = {
  listForPatient: (patientId: string) =>
    api.get<ConsentRecordOut[]>(`/consents/patient/${patientId}`),

  give: (payload: {
    patient_id: string;
    consent_type: ConsentType;
    booking_id?: string;
    capture_method?: 'digital_checkbox' | 'signature' | 'verbal' | 'paper';
    consented_by_name?: string;
    relationship_to_patient?: string;
    expires_at?: string;
    is_offline_captured?: boolean;
  }) =>
    api.post<{ id: string; status: string; given_at: string }>('/consents', {
      capture_method: 'digital_checkbox',
      ...payload,
    }),

  /** Consumers and admins only — the backend refuses worker revocations. */
  revoke: (consentId: string, reason: string) =>
    api.post<{ id: string; status: string }>(`/consents/${consentId}/revoke`, undefined, {
      params: { reason },
    }),
};
