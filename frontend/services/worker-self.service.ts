import { api } from '../lib/api';

export interface WorkerMeOut {
  id: string;
  user_id: string;
  tier: string;
  gender: string | null;
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

export const workerSelfService = {
  me: () => api.get<WorkerMeOut>('/workers/me'),
  updateMe: (patch: Partial<WorkerMeOut>) => api.put<WorkerMeOut>('/workers/me', patch),
  updateAvailability: (availability: 'online' | 'offline' | 'busy' | 'on_leave') =>
    api.put<WorkerMeOut>('/workers/me/availability', { availability }),
  updateBankDetails: (b: { bank_account_holder: string; bank_account_number: string; bank_ifsc: string }) =>
    api.put<WorkerMeOut>('/workers/me/bank-details', b),

  // documents — backend uses query params on POST
  documents: () => api.get<DocumentOut[]>('/workers/me/documents'),
  uploadDocument: (doc: { document_type: string; cloudinary_url: string; cloudinary_public_id: string; document_number?: string }) =>
    api.post<{ id: string; verification_status: string }>(`/workers/me/documents`, undefined, { params: doc }),

  certificates: () => api.get<CertificateOut[]>('/workers/me/certificates'),

  kit: () => api.get<KitItemOut[]>('/workers/me/kit'),
  toggleKitItem: (kitId: string, is_present: boolean, notes?: string) =>
    api.put<{ ok: boolean; kit_complete: boolean }>(`/workers/me/kit/${kitId}`, undefined, {
      params: { is_present, ...(notes ? { notes } : {}) },
    }),

  earnings: () => api.get<EarningsOut>('/workers/me/earnings'),

  // Patch 3 — Worker current-location ping for Haversine proximity dispatch.
  updateLocation: (loc: { latitude: number; longitude: number; accuracy?: number; captured_at?: string }) =>
    api.post<{
      ok: boolean;
      current_latitude: number;
      current_longitude: number;
      current_location_updated_at: string;
      current_location_accuracy: number | null;
    }>('/workers/me/location', loc),
};
