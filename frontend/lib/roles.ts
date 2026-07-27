/**
 * Role model for the mobile app.
 *
 * Mirrors the web frontend's `src/lib/rbac.ts` but only covers the roles the
 * app actually ships screens for. Admin / reviewer / operations / support are
 * deliberately web-only: those portals are dense data-table workflows that
 * have no mobile equivalent, so we sign those users out with a clear message
 * rather than dropping them into a blank shell.
 */

/** Roles as the backend's `UserRole` enum spells them. */
export type BackendRole =
  | 'consumer'
  | 'worker'
  | 'admin'
  | 'reviewer'
  | 'operations'
  | 'support'
  | 'clinical_training_lead'
  | 'clinical_trainer';

/** Roles this app renders a portal for. */
export type AppRole = 'family' | 'nurse' | 'trainer' | 'clinical_lead';

/** Roles a user can create for themselves from the app. */
export type SelfRegisterRole = Extract<AppRole, 'family' | 'nurse'>;

export const SELF_REGISTER_ROLES: {
  id: SelfRegisterRole;
  label: string;
  tagline: string;
}[] = [
  { id: 'family', label: 'Family / Patient', tagline: 'Book care for a loved one' },
  { id: 'nurse', label: 'Care Professional', tagline: 'Offer skilled care on the marketplace' },
];

const BACKEND_TO_APP: Partial<Record<BackendRole, AppRole>> = {
  consumer: 'family',
  worker: 'nurse',
  clinical_trainer: 'trainer',
  clinical_training_lead: 'clinical_lead',
};

const APP_TO_BACKEND: Record<AppRole, BackendRole> = {
  family: 'consumer',
  nurse: 'worker',
  trainer: 'clinical_trainer',
  clinical_lead: 'clinical_training_lead',
};

/** Roles that exist on the backend but have no mobile portal. */
export const WEB_ONLY_ROLES: BackendRole[] = ['admin', 'reviewer', 'operations', 'support'];

export function toBackendRole(role: AppRole): BackendRole {
  return APP_TO_BACKEND[role];
}

/**
 * Map a backend role onto an app portal. Returns `null` for web-only roles so
 * callers can show the "use the web portal" message instead of guessing.
 */
export function toAppRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  return BACKEND_TO_APP[role as BackendRole] ?? null;
}

export function isWebOnlyRole(role: string | null | undefined): boolean {
  return !!role && WEB_ONLY_ROLES.includes(role as BackendRole);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  family: 'Family Member',
  nurse: 'Care Professional',
  trainer: 'Clinical Trainer',
  clinical_lead: 'Clinical Training Lead',
};

export const WEB_ONLY_ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  operations: 'Operations',
  support: 'Support',
};

/** Landing route for each portal, used after login and on session restore. */
export const PORTAL_HOME: Record<AppRole, string> = {
  family: '/(family)/dashboard',
  nurse: '/(nurse)/dashboard',
  trainer: '/(trainer)/modules',
  clinical_lead: '/(lead)/review',
};

export function portalHome(role: AppRole | null): string {
  return role ? PORTAL_HOME[role] : '/role-select';
}
