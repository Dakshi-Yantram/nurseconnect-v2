/**
 * Doctor-issued e-prescriptions — /api/eprescriptions/*.
 *
 * Distinct from the older "patient uploads a photo of a paper Rx" flow
 * (prescriptions.service / visits.service). This is the in-app flow where a
 * doctor (WorkerType.doctor) writes drugs + diet notes + patient issues
 * during/after a teleconsultation, and the backend renders a signed,
 * QR-verifiable PDF.
 *
 * A doctor must have a saved signature (see `uploadSignature`) before they
 * can issue any e-Rx — the backend rejects `create` with a 400 otherwise.
 */
import { api } from '../lib/api';

export interface DrugLine {
  name: string;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  scheduled_drug?: boolean;
}

export interface SignatureStatus {
  has_signature: boolean;
  signature_url: string | null;
  uploaded_at: string | null;
}

export interface EPrescriptionOut {
  id: string;
  booking_id: string | null;
  patient_id: string;
  status: string;
  pdf_url: string | null;
  qr_code_url: string | null;
  verification_hash: string | null;
  prescribed_date: string | null;
  valid_until: string | null;
  diet_notes: string | null;
  patient_issues: string | null;
  drugs_listed: DrugLine[] | null;
}

export interface EPrescriptionCreatePayload {
  booking_id: string;
  drugs_listed: DrugLine[];
  diet_notes?: string | null;
  patient_issues?: string | null;
  valid_days?: number;
}

export const eprescriptionsService = {
  getSignature: () => api.get<SignatureStatus>('/eprescriptions/signature').then((r) => r.data),

  /** `imageBase64` may be a raw base64 string or a `data:image/png;base64,...` URI — the backend accepts both. */
  uploadSignature: (imageBase64: string) =>
    api
      .post<{ signature_url: string; uploaded_at: string }>('/eprescriptions/signature', {
        image_base64: imageBase64,
      })
      .then((r) => r.data),

  create: (payload: EPrescriptionCreatePayload) =>
    api.post<EPrescriptionOut>('/eprescriptions', payload).then((r) => r.data),

  get: (id: string) => api.get<EPrescriptionOut>(`/eprescriptions/${id}`).then((r) => r.data),

  listForBooking: (bookingId: string) =>
    api.get<EPrescriptionOut[]>(`/eprescriptions/booking/${bookingId}`).then((r) => r.data),
};
