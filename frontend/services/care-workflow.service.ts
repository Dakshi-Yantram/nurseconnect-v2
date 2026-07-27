/**
 * Patch 4 — Dynamic care workflow client.
 *
 * Backed by /api/care/workflow/* endpoints. All checklist / documentation
 * shapes (question types, required flags, blocking rules) come from the
 * backend response — nothing is hardcoded here.
 */
import { api } from '../lib/api';

export type WorkflowQuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'photo'
  | 'vitals_entry'
  | 'medication_entry'
  | 'consent_confirmation';

export interface WorkflowChecklistQuestion {
  id: string;
  text: string;
  type: WorkflowQuestionType;
  required?: boolean;
  options?: string[];
  phase?: string;
  [k: string]: any;
}

export interface WorkflowChecklistTemplate {
  id: string;
  code: string;
  name: string;
  version: number;
  phase: string;
  questions: WorkflowChecklistQuestion[];
}

export interface WorkflowDocumentationField {
  field_id: string;
  label: string;
  type: WorkflowQuestionType;
  required?: boolean;
  blocks_checkout?: boolean;
  [k: string]: any;
}

export interface WorkflowDocumentationTemplate {
  id: string;
  code: string;
  name: string;
  version: number;
  mandatory_fields: WorkflowDocumentationField[];
  wound_image_mandatory: boolean;
  photo_consent_required: boolean;
}

export interface WorkflowMissingItem {
  type: 'checklist' | 'documentation';
  id: string;
  label: string;
  kind: WorkflowQuestionType;
  blocks_checkout: boolean;
}

export interface WorkflowExistingChecklistResponse {
  id: string;
  question_id: string;
  question_text_snapshot: string;
  answer_json: { value?: any } | null;
  is_required: boolean;
  is_completed: boolean;
  answered_at: string | null;
  template_version: number;
  phase: string;
}

export interface WorkflowExistingDocumentationItem {
  id: string;
  field_id: string;
  field_label_snapshot: string;
  field_type: WorkflowQuestionType;
  value_json: { value?: any } | null;
  file_url: string | null;
  is_required: boolean;
  blocks_checkout: boolean;
  is_completed: boolean;
  completed_at: string | null;
  template_version: number;
}

export interface CompletionStatus {
  can_checkout: boolean;
  missing_items: WorkflowMissingItem[];
  blocking_items: WorkflowMissingItem[];
}

export interface CareWorkflow {
  booking_id: string;
  workflow_source: 'package' | 'service' | 'fallback';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  service: { id: string; service_code: string; name: string; risk_level: string } | null;
  package: { id: string; package_code: string; name: string } | null;
  checklist_template: WorkflowChecklistTemplate | null;
  documentation_template: WorkflowDocumentationTemplate | null;
  family_summary_template: string | null;
  existing_responses: {
    checklist: WorkflowExistingChecklistResponse[];
    documentation: WorkflowExistingDocumentationItem[];
  };
  completion_status: CompletionStatus;
}

export interface WorkflowErrorResponse {
  success: false;
  code: string;
  message: string;
  missing_items?: WorkflowMissingItem[];
}

export const careWorkflowService = {
  get: (bookingId: string) => api.get<CareWorkflow | WorkflowErrorResponse>(`/care/workflow/${bookingId}`),

  submitResponses: (
    bookingId: string,
    responses: { question_id: string; answer: any }[],
    isOfflineSubmitted = false,
  ) =>
    api.post<{ saved: any[]; completion_status: CompletionStatus }>(
      `/care/workflow/${bookingId}/responses`,
      { responses, is_offline_submitted: isOfflineSubmitted },
    ),

  submitDocumentationItem: (
    bookingId: string,
    item: { field_id: string; value?: any; file_url?: string },
    isOfflineSubmitted = false,
  ) =>
    api.post<{ saved: any[]; completion_status: CompletionStatus }>(
      `/care/workflow/${bookingId}/documentation`,
      { ...item, is_offline_submitted: isOfflineSubmitted },
    ),

  completionStatus: (bookingId: string) =>
    api.get<CompletionStatus & { workflow_source?: string; risk_level?: string }>(
      `/care/workflow/${bookingId}/completion-status`,
    ),

  /**
   * Multipart upload — returns a public /api/uploads/... URL.
   *
   * Goes through `api.upload` so the request picks up the shared auth header
   * and 401-refresh handling; the previous hand-rolled `fetch` bypassed the
   * interceptor, so an expired token failed the upload instead of refreshing.
   */
  uploadDocumentationFile: (
    bookingId: string,
    fieldId: string,
    fileUri: string,
    fileName?: string,
    mimeType: string = 'image/jpeg',
  ): Promise<{ file_url: string; field_id: string; size_bytes: number }> =>
    api.upload<{ file_url: string; field_id: string; size_bytes: number }>(
      `/care/workflow/${bookingId}/documentation/file`,
      { uri: fileUri, name: fileName || `${fieldId}.jpg`, type: mimeType },
      { field_id: fieldId },
    ),
};
