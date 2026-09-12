/**
 * Provider Type capabilities — the single place the app decides which
 * features a care professional sees.
 *
 * Mirrors `app/core/provider_types.py` on the backend. Screens ask
 * `canTele(type)` / `canPhysical(type)` instead of testing
 * `workerType === 'doctor'`, so adding a provider type does not mean
 * hunting through screens for role checks.
 *
 * The backend is the authority: it refuses tele endpoints to a
 * non-tele-capable provider (403 TELE_DOCTOR_REQUIRED). This module decides
 * what to *render*, not what is permitted — it keeps a Physical Doctor from
 * being shown a waiting queue and call button that would only 403.
 */

import { ALL_PROVIDER_TYPE_LABELS, type ProviderType } from '../constants/providerTypes';

export type { ProviderType };

/**
 * Types that run video consultations.
 *
 * `doctor` — the generic type used before the Tele/Physical split — is in
 * BOTH sets, so every doctor onboarded earlier keeps the features they have
 * today. New doctors register as a specific mode.
 */
const TELE_CAPABLE: ReadonlySet<string> = new Set(['doctor', 'tele_doctor']);

/** Types that attend patients in person. */
const PHYSICAL_CAPABLE: ReadonlySet<string> = new Set([
  'doctor',
  'physical_doctor',
  'nurse',
  'caregiver',
  'dentist',
  'physiotherapist',
  'mother_baby_caregiver',
]);

const DOCTOR_TYPES: ReadonlySet<string> = new Set([
  'doctor',
  'tele_doctor',
  'physical_doctor',
]);

/** May this provider run tele-consultations (waiting queue, calls, video)? */
export function canTele(type: string | null | undefined): boolean {
  return !!type && TELE_CAPABLE.has(type);
}

/** Does this provider attend in-person visits (travel, on-site procedures)? */
export function canPhysical(type: string | null | undefined): boolean {
  return !!type && PHYSICAL_CAPABLE.has(type);
}

export function isDoctor(type: string | null | undefined): boolean {
  return !!type && DOCTOR_TYPES.has(type);
}

export function providerLabel(type: string | null | undefined): string {
  if (!type) return 'Care Professional';
  return ALL_PROVIDER_TYPE_LABELS[type as ProviderType] ?? type;
}

/**
 * Which feature modules a provider's dashboard should mount.
 *
 * Returned as data rather than branching in each screen, so the tab bar,
 * home dashboard and settings all derive from one decision.
 */
export interface ProviderFeatures {
  /** Patient waiting queue + call button + video consultation. */
  teleConsultation: boolean;
  /** Visit list, navigation, on-site checklists and procedures. */
  physicalVisits: boolean;
  /** Procedure/service sign-off (nail procedures, dressings, etc). */
  procedures: boolean;
  /** Can issue e-prescriptions. */
  ePrescriptions: boolean;
  /** Cash collection at the visit — only where there is a visit. */
  cashCollection: boolean;
}

export function featuresFor(type: string | null | undefined): ProviderFeatures {
  const tele = canTele(type);
  const physical = canPhysical(type);
  return {
    teleConsultation: tele,
    physicalVisits: physical,
    procedures: physical,
    // Prescribing authority follows medical registration, not the mode —
    // both doctor types may prescribe.
    ePrescriptions: isDoctor(type),
    // Cash is handed over in person, so it only applies to visits.
    cashCollection: physical,
  };
}
