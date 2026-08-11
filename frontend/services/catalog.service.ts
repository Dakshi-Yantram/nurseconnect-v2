import { api } from '../lib/api';
import type { BackendService } from './mappers';

export interface CarePackageOut {
  id: string;
  package_code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  target_condition: string | null;
  min_tier: string;
  visit_frequency: string;
  visits_per_cycle: number | null;
  cycle_duration_days: number | null;
  shift_hours: number | null;
  package_price: string;
  per_visit_price: string;
  subsidy_eligible: boolean;
  is_active: boolean;
  /** Composite Care Package — bundles a procedural kit with the visit. */
  material_included: boolean;
}

export const catalogService = {
  listServices: () => api.get<BackendService[]>('/services'),
  getService: (id: string) => api.get<BackendService>(`/services/${id}`),
  listPackages: () => api.get<CarePackageOut[]>('/care-packages'),
  getPackage: (id: string) => api.get<CarePackageOut>(`/care-packages/${id}`),
};
