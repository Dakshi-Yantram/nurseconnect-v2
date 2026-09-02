/**
 * Provider contracts — /api/contracts/*.
 *
 * Two-stage flow:
 *  - Stage 1: in-app clickwrap agreement, accepted via checkbox + OTP.
 *    Gates initial app access. Free.
 *  - Stage 2: Master Independent Contractor Agreement on state e-Stamp
 *    paper, unlocked after the worker's first completed booking, executed
 *    via Aadhaar eSign. Gates booking #2 onwards.
 *
 * The rendered contract text is generated server-side per provider type
 * (nurse/doctor/dentist/physio get a registration-number clause with the
 * right council name; caregivers get none) — this file never hardcodes
 * contract wording, it just displays whatever /contracts/me returns.
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

export const contractsService = {
  getMyContracts: () => api.get<ContractPreview[]>('/contracts/me').then((r) => r.data),

  sendStage1Otp: () =>
    api.post<{ sent: boolean; dev_otp: string | null }>('/contracts/me/stage1/send-otp').then((r) => r.data),

  acceptStage1: (otpCode: string) =>
    api.post<ContractPreview>('/contracts/me/stage1/accept', { otp_code: otpCode }).then((r) => r.data),

  acceptStage2: (payload: { esign_reference_id: string; esign_document_url?: string; esign_provider?: string; address?: string }) =>
    api.post<ContractPreview>('/contracts/me/stage2/accept', payload).then((r) => r.data),

  applyOcrSuggestion: (documentId: string, applyName: boolean, applyRegistrationNo: boolean) =>
    api
      .post<{ applied: Record<string, string> }>(`/contracts/me/documents/${documentId}/apply-ocr`, {
        apply_name: applyName,
        apply_registration_no: applyRegistrationNo,
      })
      .then((r) => r.data),
};
