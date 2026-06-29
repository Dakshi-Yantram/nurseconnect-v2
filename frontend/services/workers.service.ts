import { api } from '../lib/api';
import type { BackendWorker } from './mappers';

export interface WorkerSearchParams {
  city?: string;
  service_code?: string;
  tier?: string;
  gender?: string;
  language?: string;
  rating_min?: number;
  available_now?: boolean;
}

// Patch 2 — service qualification + opt-in
export type QualificationStatus =
  | 'NOT_QUALIFIED' 
  | 'TRAINING_REQUIRED'
  | 'TEST_FAILED'
  | 'QUALIFIED_PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type PreferenceStatus = 'OPTED_IN' | 'OPTED_OUT' | 'PAUSED';

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

export const workersService = {
search: (params: WorkerSearchParams = {}) =>
  api.get<BackendWorker[]>('/workers/search', {
    params: {
      city: params.city,

      // Adapter mappings for Patch5B backend
      min_tier: params.tier,
      available_only: params.available_now,

      gender: params.gender,
    },
  }),
  publicProfile: (id: string) => api.get<BackendWorker>(`/workers/${id}/public`),
  // Patch 2
  getServiceEligibility: () =>
    api.get<ServiceEligibilityItem[]>('/workers/me/service-eligibility'),
  updateServicePreference: (payload: {
    target_type: 'service' | 'package';
    target_id: string;
    preference_status: PreferenceStatus;
    notes?: string;
    preferred_radius_km?: number;
  }) =>
    api.put<ServiceEligibilityItem>(
      '/workers/me/service-preferences',
      payload,
    ),
};
