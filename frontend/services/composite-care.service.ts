/**
 * Composite Care Package (Workflow 1) — service layer.
 *
 * Mirrors `visits.service.ts`'s conventions and talks to the
 * `/composite-care/...` router added on the backend. Covers Steps 1 and
 * 4–7 of the spec (Step 2/3 — pharmacist approval and dispatch — are admin
 * / existing-flow concerns, not this app).
 */
import { api } from '../lib/api';

/* ============================================================
   Step 4 — synchronized safety checklist
   ============================================================ */

/** The five yes/no items both the nurse and the patient answer. */
export interface SafetyChecklistAnswers {
  hand_hygiene: boolean;
  sterile_gloves: boolean;
  identity_and_wellbeing_check: boolean;
  allergy_and_complaint_history: boolean;
  prescription_and_expiry_check: boolean;
}

export interface SafetyChecklistItem {
  key: keyof SafetyChecklistAnswers;
  label: string;
}

/** Shared copy so the nurse and patient cards render identical wording. */
export const SAFETY_CHECKLIST_ITEMS: SafetyChecklistItem[] = [
  { key: 'hand_hygiene', label: 'Sanitized hands in front of patient/family' },
  { key: 'sterile_gloves', label: 'Donned fresh, sterile gloves' },
  { key: 'identity_and_wellbeing_check', label: "Verified patient identity & asked how they're feeling today" },
  { key: 'allergy_and_complaint_history', label: 'Assessed allergy history & current chief complaints' },
  { key: 'prescription_and_expiry_check', label: "Verified doctor's prescription & drug expiry date" },
];

export interface NurseSafetyChecklistSubmit extends SafetyChecklistAnswers {
  notes?: string;
}

export interface SafetyChecklistStatusOut {
  nurse_checklist: (Record<string, boolean> & { notes?: string }) | null;
  nurse_submitted_at: string | null;
  patient_verification: Record<string, boolean> | null;
  patient_submitted_at: string | null;
  quality_discrepancy: boolean;
  both_submitted: boolean;
}

/** Shape of the 409 the backend raises when nurse/patient answers mismatch. */
export interface QualityDiscrepancyDetail {
  code: 'QUALITY_DISCREPANCY_ALERT';
  message: string;
  mismatched_items: string[];
}

/* ============================================================
   Step 5 / 6 — photo proof + completion OTP
   ============================================================ */

export interface PhotoSubmit {
  /** Already-hosted URL (skip upload). Provide this OR photo_base64. */
  photo_url?: string;
  /** Raw base64 or data: URI straight from the camera — backend uploads it. */
  photo_base64?: string;
  latitude: number;
  longitude: number;
}

export interface VisitRecordOut {
  id: string;
  booking_id: string;
  worker_id: string;
  patient_id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  actual_duration_minutes: number | null;
  documentation_complete: boolean;
  family_summary: string | null;
  care_notes: string | null;
  created_at: string;
}

export interface CompletionOtpGenerateOut {
  sent: boolean;
  sms_sent: boolean;
  message: string;
  expires_in_seconds: number;
  otp: string;
}

export interface InvoiceOut {
  id: string;
  booking_id: string;
  invoice_number: string;
  invoice_type: string;
  gst_percent: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  line_items: { description: string; amount: number | string }[];
  pdf_url: string | null;
  generated_at: string;
}

export interface CompositeCheckoutOut {
  visit: VisitRecordOut;
  invoice: InvoiceOut;
}

/* ============================================================
   Step 1 — booking + Rx upload
   ============================================================ */

export interface CompositeBookingCreate {
  package_id: string;
  patient_id: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_start_time: string; // HH:MM:SS
  address_snapshot: Record<string, any>;
  latitude: number;
  longitude: number;
  special_instructions?: string;
  /** Raw base64 / data: URI of the Rx photo or file — backend uploads it. */
  prescription_base64?: string;
  /** Or pass an already-hosted URL + public id instead of base64. */
  prescription_cloudinary_url?: string;
  prescription_cloudinary_public_id?: string;
}

export const compositeCareService = {
  createBooking: (payload: CompositeBookingCreate) =>
    api.post<any>(`/composite-care/bookings`, payload),

  // ---- Step 4: synchronized safety checklist -----------------------------
  submitNurseChecklist: (bookingId: string, payload: NurseSafetyChecklistSubmit) =>
    api.post<SafetyChecklistStatusOut>(
      `/composite-care/bookings/${bookingId}/nurse-safety-checklist`,
      payload,
    ),
  submitPatientVerification: (bookingId: string, payload: SafetyChecklistAnswers) =>
    api.post<SafetyChecklistStatusOut>(
      `/composite-care/bookings/${bookingId}/patient-safety-verification`,
      payload,
    ),
  getChecklistStatus: (bookingId: string) =>
    api.get<SafetyChecklistStatusOut>(`/composite-care/bookings/${bookingId}/safety-checklist-status`),

  // ---- Step 5: pre-procedure photo (unlocks IN_PROGRESS) -----------------
  submitPreProcedurePhoto: (bookingId: string, payload: PhotoSubmit) =>
    api.post<VisitRecordOut>(`/composite-care/bookings/${bookingId}/pre-procedure-photo`, payload),

  // ---- Step 6: post-procedure photo + completion OTP ----------------------
  submitPostProcedurePhoto: (bookingId: string, payload: PhotoSubmit) =>
    api.post<VisitRecordOut>(`/composite-care/bookings/${bookingId}/post-procedure-photo`, payload),
  generateCompletionOtp: (bookingId: string) =>
    api.post<CompletionOtpGenerateOut>(`/composite-care/bookings/${bookingId}/generate-completion-otp`),
  verifyCompletionOtp: (
    bookingId: string,
    payload: { otp: string; latitude: number; longitude: number; family_summary?: string; care_notes?: string },
  ) =>
    api.post<CompositeCheckoutOut>(`/composite-care/bookings/${bookingId}/verify-completion-otp`, payload),

  // ---- Step 7: invoice -----------------------------------------------------
  getInvoice: (bookingId: string) => api.get<InvoiceOut>(`/composite-care/bookings/${bookingId}/invoice`),
};
