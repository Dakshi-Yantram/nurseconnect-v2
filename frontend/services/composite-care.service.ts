/**
 * Guarded visit workflows — service layer.
 *
 * Workflow 1 — Composite Care Package (`material_included`): the platform
 * supplies the procedural kit.
 * Workflow 2 — Service-Only: the patient supplies their own materials, so
 * booking carries a supply guardrail and the nurse additionally inspects and
 * expiry-checks those supplies on arrival.
 *
 * Mirrors `visits.service.ts`'s conventions and talks to the
 * `/composite-care/...` router. Covers Steps 1 and 4–7 of the spec (Step 2/3
 * — pharmacist approval and dispatch — are admin / existing-flow concerns,
 * not this app).
 */
import { api } from '../lib/api';

/* ============================================================
   Step 4 — synchronized safety checklist
   ============================================================ */

/**
 * The union of both workflows' yes/no items. Each workflow asks exactly five;
 * `hand_hygiene` and `sterile_gloves` are common to both. The backend
 * validates that the five belonging to *this booking's* workflow are all
 * answered, so the rest are optional here.
 */
export interface SafetyChecklistAnswers {
  hand_hygiene: boolean;
  sterile_gloves: boolean;
  // Workflow 1 only.
  identity_and_wellbeing_check?: boolean;
  allergy_and_complaint_history?: boolean;
  prescription_and_expiry_check?: boolean;
  // Workflow 2 only.
  health_condition_check?: boolean;
  supply_packaging_intact?: boolean;
  supply_expiry_check?: boolean;
}

export type SafetyChecklistKey = keyof SafetyChecklistAnswers;

export interface SafetyChecklistItem {
  key: SafetyChecklistKey;
  label: string;
}

/** Workflow 1 — Pre-Procedure Clinical & Intake Questionnaire. */
export const SAFETY_CHECKLIST_ITEMS: SafetyChecklistItem[] = [
  { key: 'hand_hygiene', label: 'Sanitized hands in front of patient/family' },
  { key: 'sterile_gloves', label: 'Donned fresh, sterile gloves' },
  { key: 'identity_and_wellbeing_check', label: "Verified patient identity & asked how they're feeling today" },
  { key: 'allergy_and_complaint_history', label: 'Assessed allergy history & current chief complaints' },
  { key: 'prescription_and_expiry_check', label: "Verified doctor's prescription & drug expiry date" },
];

/** Workflow 2 — Pre-Procedure & Patient Supply Inspection. */
export const SERVICE_ONLY_CHECKLIST_ITEMS: SafetyChecklistItem[] = [
  { key: 'hand_hygiene', label: 'Sanitized hands in front of patient' },
  { key: 'sterile_gloves', label: 'Wore fresh, sterile gloves' },
  { key: 'health_condition_check', label: "Asked about patient's current health condition & chief complaints" },
  { key: 'supply_packaging_intact', label: 'Inspected patient supplies: sterile packaging is unbroken' },
  { key: 'supply_expiry_check', label: "Expiry check: patient's supplies/medicine are not expired" },
];

/** Pick the five items this booking's workflow asks. */
export function checklistItemsFor(materialIncluded: boolean): SafetyChecklistItem[] {
  return materialIncluded ? SAFETY_CHECKLIST_ITEMS : SERVICE_ONLY_CHECKLIST_ITEMS;
}

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
  /** Which workflow this booking runs — drives which five items to render. */
  material_included: boolean;
  checklist_items: string[];
  supply_issue_reported: boolean;
}

/** Workflow 2 — nurse found a problem with the patient's own supplies. */
export type SupplyIssueType =
  | 'packaging_broken'
  | 'expired'
  | 'missing'
  | 'wrong_item'
  | 'other';

export interface SupplyIssueReport {
  issue_type: SupplyIssueType;
  notes?: string;
}

export const SUPPLY_ISSUE_OPTIONS: { value: SupplyIssueType; label: string }[] = [
  { value: 'packaging_broken', label: 'Sterile packaging is broken' },
  { value: 'expired', label: 'Supplies / medicine are expired' },
  { value: 'missing', label: 'Required supplies are missing' },
  { value: 'wrong_item', label: 'Wrong item for this procedure' },
  { value: 'other', label: 'Other issue' },
];

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

/**
 * Workflow 2 Step 1 — the supply guardrail. Every item must be ticked and a
 * supply photo attached, or the backend refuses to create the booking (so no
 * payable booking exists until the guardrail passes).
 */
export interface SupplyConfirmation {
  medicine: boolean;
  cannula_or_catheter: boolean;
  drip_set: boolean;
  prescription: boolean;
}

export const SUPPLY_CONFIRMATION_ITEMS: { key: keyof SupplyConfirmation; label: string }[] = [
  { key: 'medicine', label: 'I have the prescribed medicine ready' },
  { key: 'cannula_or_catheter', label: 'I have the cannula / catheter ready' },
  { key: 'drip_set', label: 'I have the drip set ready' },
  { key: 'prescription', label: "I have the doctor's prescription ready" },
];

export interface ServiceOnlyBookingCreate
  extends Omit<CompositeBookingCreate, never> {
  supply_confirmation: SupplyConfirmation;
  /** Photo of the supplies laid out next to the prescription. */
  supply_photo_base64?: string;
  supply_photo_url?: string;
}

export const compositeCareService = {
  createBooking: (payload: CompositeBookingCreate) =>
    api.post<any>(`/composite-care/bookings`, payload),

  /** Workflow 2 — books a Service-Only package with the supply guardrail. */
  createServiceOnlyBooking: (payload: ServiceOnlyBookingCreate) =>
    api.post<any>(`/composite-care/bookings/service-only`, payload),

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

  /** Workflow 2 — nurse reports a problem with the patient's own supplies.
   *  Blocks the procedure and raises an ops escalation. */
  reportSupplyIssue: (bookingId: string, payload: SupplyIssueReport) =>
    api.post<SafetyChecklistStatusOut>(
      `/composite-care/bookings/${bookingId}/report-supply-issue`,
      payload,
    ),

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
