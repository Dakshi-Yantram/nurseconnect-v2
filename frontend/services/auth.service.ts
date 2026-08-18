/**
 * Auth API service — typed wrappers around the backend's /api/auth/* routes.
 *
 * The paths here are the ones the backend actually mounts (see
 * backend/app/api/v1/auth.py). Earlier versions of this file posted to
 * `/auth/send-otp`, `/auth/verify-otp` and `/auth/login` with a phone payload,
 * none of which exist — every one of them 404'd or 422'd, which is why OTP
 * never arrived and phone login always failed.
 */
import { api, type RequestOptions } from '../lib/api';
import { authStorage } from '../lib/auth-storage';
import { toAppRole, toBackendRole, type AppRole, type BackendRole, type SelfRegisterRole } from '../lib/roles';
import type { ProviderType } from '../constants/providerTypes';

export type { AppRole, BackendRole } from '../lib/roles';
export { toAppRole, toBackendRole } from '../lib/roles';

export interface BackendUser {
  id: string;
  phone_e164: string;
  email: string | null;
  full_name: string | null;
  role: BackendRole;
  status: string;
  avatar_url: string | null;
  preferred_language: string;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: BackendUser;
  tokens: TokenPair;
}

export interface SendOtpResponse {
  sent: boolean;
  phone_e164: string;
  expires_in_seconds: number;
  dev_otp?: string | null;
}

export interface RegisterResponse {
  registered: boolean;
  email: string;
  expires_in_seconds: number;
  dev_verification_code?: string | null;
}

/** Backend expects E.164. Bare 10-digit Indian numbers get the +91 prefix. */
export function normalizePhone(raw: string): string {
  const p = raw.replace(/[\s-]/g, '');
  if (p.startsWith('+')) return p;
  return `+91${p.replace(/^0/, '')}`;
}

/** Mirrors the backend's `_validate_password` so we fail fast client-side. */
export function isPasswordValid(pw: string): boolean {
  return (
    pw.length >= 8 &&
    new TextEncoder().encode(pw).length <= 72 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /\d/.test(pw)
  );
}

export const PASSWORD_HINT =
  '8+ characters, with an uppercase letter, a lowercase letter, and a number.';

async function persist(res: AuthResponse): Promise<AuthResponse> {
  await authStorage.saveTokens(res.tokens.access_token, res.tokens.refresh_token);
  await authStorage.saveUser(res.user);
  const appRole = toAppRole(res.user.role);
  if (appRole) await authStorage.saveRole(appRole);
  return res;
}

/** Auth endpoints must not send a stale Authorization header. */
const NO_AUTH: RequestOptions = { skipAuth: true };

export const authService = {
  // ---------------------------------------------------------------------
  // Email + password (all roles, including trainer / clinical lead whose
  // accounts are created for them by Operations on the web portal)
  // ---------------------------------------------------------------------
  async login(email: string, password: string, deviceId?: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>(
      '/auth/login',
      {
        email: email.trim().toLowerCase(),
        password,
        device_id: deviceId,
        device_platform: 'expo',
      },
      NO_AUTH,
    );
    return persist(res);
  },

  async register(input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: SelfRegisterRole;
    worker_type?: ProviderType;
  }): Promise<RegisterResponse> {
    return api.post<RegisterResponse>(
      '/auth/register',
      {
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        phone_e164: normalizePhone(input.phone),
        password: input.password,
        role: toBackendRole(input.role),
        ...(input.role === 'nurse' ? { worker_type: input.worker_type ?? 'nurse' } : {}),
      },
      NO_AUTH,
    );
  },

  async verifyEmail(email: string, code: string): Promise<{ verified: boolean; role: string }> {
    return api.post<{ verified: boolean; role: string }>(
      '/auth/verify-email',
      { email: email.trim().toLowerCase(), code: code.trim() },
      NO_AUTH,
    );
  },

  async resendEmailVerification(email: string): Promise<RegisterResponse> {
    return api.post<RegisterResponse>(
      '/auth/resend-email-verification',
      { email: email.trim().toLowerCase() },
      NO_AUTH,
    );
  },

  // ---------------------------------------------------------------------
  // Phone OTP (consumer only — the backend rejects worker numbers here and
  // tells them to use the care-professional login)
  // ---------------------------------------------------------------------
  async sendOtp(phone: string, purpose: 'login' | 'signup' = 'login'): Promise<SendOtpResponse> {
    return api.post<SendOtpResponse>(
      '/auth/otp/send',
      { phone_e164: normalizePhone(phone), purpose },
      NO_AUTH,
    );
  },

  async verifyOtp(phone: string, code: string, deviceId?: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>(
      '/auth/otp/verify',
      {
        phone_e164: normalizePhone(phone),
        code: code.trim(),
        role: 'consumer',
        device_id: deviceId,
        device_platform: 'expo',
      },
      NO_AUTH,
    );
    return persist(res);
  },

  // ---------------------------------------------------------------------
  // Password reset (SMS code to the registered phone)
  // ---------------------------------------------------------------------
  async forgotPassword(email: string): Promise<{ sent: boolean; message: string }> {
    return api.post<{ sent: boolean; message: string }>(
      '/auth/forgot-password',
      { email: email.trim().toLowerCase() },
      NO_AUTH,
    );
  },

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ reset: boolean; message: string }> {
    return api.post<{ reset: boolean; message: string }>(
      '/auth/reset-password',
      { email: email.trim().toLowerCase(), code: code.trim(), new_password: newPassword },
      NO_AUTH,
    );
  },

  // ---------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------
  async me(): Promise<BackendUser> {
    return api.get<BackendUser>('/auth/me');
  },

  async logout(): Promise<void> {
    const refresh = await authStorage.getRefreshToken();
    try {
      if (refresh) {
        await api.post('/auth/logout', { refresh_token: refresh }, NO_AUTH);
      }
    } catch {
      // Ignore — we clear locally regardless.
    }
    await authStorage.clearAll();
  },

  /**
   * Restore a session on cold start.
   *
   * Distinguishes "token rejected" (caller must sign in again) from "device is
   * offline" (keep the cached user so the app still opens). The old version
   * returned the cached user on *any* failure, which left revoked sessions
   * looking signed-in until the first API call failed.
   */
  async restoreSession(): Promise<BackendUser | null> {
    const token = await authStorage.getAccessToken();
    if (!token) return null;
    try {
      const u = await api.get<BackendUser>('/auth/me');
      await authStorage.saveUser(u);
      return u;
    } catch (e: any) {
      if (e?.network) {
        // Offline — the interceptor never got a response, so the token may
        // still be good. Fall back to the cached user.
        return await authStorage.getUser<BackendUser>();
      }
      // A real rejection (401/403 after the refresh attempt failed).
      await authStorage.clearAll();
      return null;
    }
  },
};
