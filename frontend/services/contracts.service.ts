/**
 * Provider contracts — /api/contracts/*.
 *
 * Two-stage flow:
 *  - Stage 1: in-app clickwrap agreement, accepted via checkbox + OTP.
 *    Gates initial app access. Free.
 *  - Stage 2: Master Independent Contractor Agreement on state e-Stamp
 *    paper, unlocked after the worker's first completed booking, executed
 *    via real Aadhaar eSign through Digio.
 *
 * The rendered contract text is generated server-side per provider type
 * (nurse/doctor/dentist/physio get a registration-number clause with the
 * right council name; caregivers get none) — this file never hardcodes
 * contract wording, it just displays whatever /contracts/me returns.
 *
 * Stage 2 e-Sign is three server calls, none of which let this app assert
 * the outcome of signing:
 *   1. initiateStage2Esign() — server renders the agreement, uploads it to
 *      Digio, returns Digio's own hosted sign_url.
 *   2. getStage2EsignStatus() — polled while/after the signing WebView is
 *      open; the server checks with Digio (or a webhook already has),
 *      never trusting anything this app claims about what happened in the
 *      WebView.
 *   3. acceptStage2() — takes NO esign fields anymore. It finalizes only if
 *      the server's own session record says "signed".
 */
import { api } from '../lib/api';

export interface ContractPreview {
  stage: 1 | 2;
  status: 'not_applicable' | 'pending' | 'accepted' | 'voided';
  rendered_text: string | null;
  template_version: string;
  unlocked: boolean;
  reason: string | null;
}

export interface OcrSuggestion {
  name: string | null;
  registration_no: string | null;
  confidence: number;
}

export interface EsignInitiateResult {
  session_id: string;
  status: 'created' | 'sent' | 'signed' | 'failed';
  sign_url: string | null;
  expires_at: string | null;
}

export interface EsignStatusResult {
  session_id: string;
  status: 'created' | 'sent' | 'signed' | 'failed';
  sign_url: string | null;
  failure_reason: string | null;
}

export const contractsService = {
  getMyContracts: () => api.get<ContractPreview[]>('/contracts/me'),

  sendStage1Otp: () =>
    api.post<{ sent: boolean; dev_otp: string | null }>('/contracts/me/stage1/send-otp'),

  acceptStage1: (otpCode: string) =>
    api.post<ContractPreview>('/contracts/me/stage1/accept', { otp_code: otpCode }),

  /** Starts (or resumes an in-flight) Digio signing session. */
  initiateStage2Esign: () =>
    api.post<EsignInitiateResult>('/contracts/me/stage2/esign/initiate'),

  /**
   * Current signing status. Actively re-checks with Digio server-side if
   * we haven't heard back yet — call this on a short poll interval while
   * the signing WebView is open, and once more immediately after it closes.
   */
  getStage2EsignStatus: () =>
    api.get<EsignStatusResult>('/contracts/me/stage2/esign/status'),

  /**
   * MOCK MODE ONLY — simulates the Digio WebView completing successfully.
   * The backend hard-rejects this with a 403 outside mock mode, so it can
   * never be used to skip real signing in production regardless of what
   * this app sends.
   */
  mockCompleteStage2Esign: () =>
    api.post<EsignStatusResult>('/contracts/me/stage2/esign/mock-complete'),

  /**
   * Finalizes Stage 2. No esign_reference_id / esign_document_url here
   * anymore — the server decides whether signing actually happened from
   * its own session record, never from anything this call sends.
   */
  acceptStage2: (payload: { address?: string } = {}) =>
    api.post<ContractPreview>('/contracts/me/stage2/accept', payload),

  applyOcrSuggestion: (documentId: string, applyName: boolean, applyRegistrationNo: boolean) =>
    api.post<{ applied: Record<string, string> }>(`/contracts/me/documents/${documentId}/apply-ocr`, {
      apply_name: applyName,
      apply_registration_no: applyRegistrationNo,
    }),
};

