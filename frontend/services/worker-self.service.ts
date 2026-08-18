import { api } from '../lib/api';
import type { ProviderType } from '../constants/providerTypes';

export interface WorkerMeOut {
  id: string;
  user_id: string;
  tier: string;
  gender: string | null;
  worker_type?: ProviderType;
  onboarding_status: string;
  availability: 'online' | 'offline' | 'busy' | 'on_leave';
  bio: string | null;
  years_of_experience: number;
  languages_spoken: string[] | null;
  specialisations: string[] | null;
  rating_average: string;
  rating_count: number;
  completed_visits_count: number;
  base_city: string | null;
  date_of_birth?: string | null;
  registration_no?: string | null;
  registration_authority?: string | null;
  registration_valid_until?: string | null;
  service_radius_km?: number | null;
  home_latitude?: number | null;
  home_longitude?: number | null;
  kit_complete?: boolean;
}

export interface CertificateOut {
  id: string;
  name: string;
  issued_by: string | null;
  issued_on: string | null;
  valid_until: string | null;
  cloudinary_url: string | null;
}

export interface KitItemOut {
  id: string;
  item_code: string;
  item_name: string;
  is_present: boolean;
  last_checked_at: string | null;
  notes: string | null;
}

export interface DocumentOut {
  id: string;
  document_type: string;
  document_number: string | null;
  cloudinary_url: string | null;
  verification_status: string;
  valid_until: string | null;
  created_at: string;
}

export interface PayoutOut {
  id: string;
  booking_id: string;
  gross_amount: number;
  tds_deducted: number;
  net_amount: number;
  status: 'pending' | 'on_hold' | 'processing' | 'paid' | 'failed' | string;
  paid_at: string | null;
  created_at: string;
}

export interface EarningsOut {
  total_paid: number;
  total_pending: number;
  payouts: PayoutOut[];
}

/** One entry in the required-documents catalogue for this worker type. */
export interface DocumentCatalogueEntry {
  document_type?: string;
  type?: string;
  label?: string;
  required?: boolean;
  uploaded?: boolean;
  verification_status?: string | null;
  [k: string]: any;
}

export interface OnboardingSnapshot {
  onboarding_status: string;
  worker_type: ProviderType;
  background_check_status: string;
  documents: DocumentCatalogueEntry[];
  missing_profile_fields: string[];
  missing_documents: string[];
  rejected_documents: string[];
  can_submit_for_review: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

/** Backend enum values — uppercase, matching WorkerQualificationStatus. */
export type QualificationStatus =
  | 'NOT_QUALIFIED'
  | 'TRAINING_REQUIRED'
  | 'TEST_FAILED'
  | 'QUALIFIED_PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'EXPIRED';

/** Backend enum values — uppercase, matching WorkerPreferenceStatus. */
export type PreferenceStatus = 'OPTED_IN' | 'OPTED_OUT' | 'PAUSED';

/**
 * A bookable offering (care package or standalone service) plus this worker's
 * qualification and opt-in state for it. `can_opt_in` false means a gate is
 * unmet — `locked_reason` says which.
 */
export interface ServiceEligibilityItem {
  target_type: 'service' | 'package';
  id: string;
  code: string;
  name: string;
  category: string | null;
  min_tier: string | null;
  risk_level: string | null;
  qualification_status: QualificationStatus;
  qualification_source: string | null;
  preference_status: PreferenceStatus;
  willing_to_accept: boolean;
  can_opt_in: boolean;
  locked_reason: string | null;
  requires_admin_skill_approval: boolean;
}

export const workerSelfService = {
  me: () => api.get<WorkerMeOut>('/workers/me'),
  updateMe: (patch: Partial<WorkerMeOut>) => api.put<WorkerMeOut>('/workers/me', patch),
  updateAvailability: (availability: 'online' | 'offline' | 'busy' | 'on_leave') =>
    api.put<WorkerMeOut>('/workers/me/availability', { availability }),
  updateBankDetails: (b: {
    bank_account_holder: string;
    bank_account_number: string;
    bank_ifsc: string;
  }) => api.put<WorkerMeOut>('/workers/me/bank-details', b),

  // ----- Onboarding -----
  onboarding: () => api.get<OnboardingSnapshot>('/workers/me/onboarding'),
  /**
   * Queues the profile for reviewer approval. Rejects with a 400 carrying
   * `missing_profile_fields` / `missing_documents` / `rejected_documents`
   * when something is still outstanding — surface those lists to the user.
   */
  submitOnboarding: () => api.post<OnboardingSnapshot>('/workers/me/onboarding/submit'),

  // ----- Documents -----
  documents: () => api.get<DocumentOut[]>('/workers/me/documents'),
  /** Registers an already-hosted file. Backend reads these as query params. */
  registerDocument: (doc: {
    document_type: string;
    cloudinary_url: string;
    cloudinary_public_id: string;
    document_number?: string;
  }) =>
    api.post<{ id: string; verification_status: string }>('/workers/me/documents', undefined, {
      params: doc,
    }),
  /** Uploads the file itself; the backend stores it and creates the record. */
  uploadDocument: (payload: {
    document_type: string;
    data_base64: string;
    document_number?: string;
    valid_until?: string;
  }) => api.post<{ id: string; verification_status: string }>('/workers/me/documents/upload', payload),

  certificates: () => api.get<CertificateOut[]>('/workers/me/certificates'),

  kit: () => api.get<KitItemOut[]>('/workers/me/kit'),
  toggleKitItem: (kitId: string, is_present: boolean, notes?: string) =>
    api.put<{ ok: boolean; kit_complete: boolean }>(`/workers/me/kit/${kitId}`, undefined, {
      params: { is_present, ...(notes ? { notes } : {}) },
    }),

  earnings: () => api.get<EarningsOut>('/workers/me/earnings'),

  // ----- Service eligibility / opt-in -----
  serviceEligibility: () => api.get<ServiceEligibilityItem[]>('/workers/me/service-eligibility'),
  updateServicePreference: (payload: {
    target_type: 'service' | 'package';
    target_id: string;
    preference_status: PreferenceStatus;
    notes?: string;
    preferred_radius_km?: number;
  }) => api.put<ServiceEligibilityItem>('/workers/me/service-preferences', payload),
  /** Ask an admin to review a skill that needs manual approval. */
  requestQualification: (payload: { target_type: 'service' | 'package'; target_id: string }) =>
    api.post<ServiceEligibilityItem>('/workers/me/service-qualification-requests', payload),

  // ----- Coverage area -----
  setServiceArea: (payload: {
    base_city?: string;
    latitude?: number;
    longitude?: number;
    service_radius_km?: number;
  }) => api.put<{ ok: boolean } & Record<string, any>>('/workers/me/service-area', payload),

  /** Current-location ping that feeds the proximity dispatch radius. */
  updateLocation: (loc: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    captured_at?: string;
  }) =>
    api.post<{
      ok: boolean;
      current_latitude: number;
      current_longitude: number;
      current_location_updated_at: string;
      current_location_accuracy: number | null;
    }>('/workers/me/location', loc),
};
