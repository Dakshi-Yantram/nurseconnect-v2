/**
 * Provider Type constants — mirrors the backend's single source of truth at
 * `app/core/provider_types.py` (PROVIDER_TYPE_LABELS / LICENSED_PROVIDER_TYPES).
 *
 * Previously the mobile app's registration screen only offered
 * 'nurse' | 'caregiver' (a leftover from before the unified Provider Type
 * system), even though the backend's /auth/register accepts all six
 * WorkerType values. This file is the one place to extend that list —
 * app/login.tsx and the services below import from here.
 */

export type ProviderType =
  | 'nurse'
  | 'doctor'
  | 'tele_doctor'
  | 'physical_doctor'
  | 'dentist'
  | 'physiotherapist'
  | 'caregiver'
  | 'mother_baby_caregiver';

/**
 * Types offered to a NEW applicant on the registration screen.
 *
 * The generic 'doctor' type is deliberately absent: it predates the
 * Tele/Physical split and is kept only so existing doctor accounts keep
 * working. New doctors pick the mode they actually practise in, which is
 * what drives their form, packages and dashboard features.
 */
export const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'tele_doctor', label: 'Tele-Doctor' },
  { value: 'physical_doctor', label: 'Physical Doctor' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'physiotherapist', label: 'Physiotherapist' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'mother_baby_caregiver', label: 'Mother & Baby Caregiver' },
];

/** Every type the backend accepts, including the legacy generic doctor. */
export const ALL_PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  nurse: 'Nurse',
  doctor: 'Doctor',
  tele_doctor: 'Tele-Doctor',
  physical_doctor: 'Physical Doctor',
  dentist: 'Dentist',
  physiotherapist: 'Physiotherapist',
  caregiver: 'Caregiver',
  mother_baby_caregiver: 'Mother & Baby Caregiver',
};

export const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = PROVIDER_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<ProviderType, string>,
);

/**
 * Provider types that require a formal degree/registration-based onboarding
 * path — mirrors LICENSED_PROVIDER_TYPES in app/core/provider_types.py.
 * Caregiver and Mother & Baby Caregiver are deliberately absent.
 */
export const LICENSED_PROVIDER_TYPES: ProviderType[] = [
  'tele_doctor',
  'physical_doctor',
  'nurse',
  'doctor',
  'dentist',
  'physiotherapist',
];
