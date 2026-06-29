/**
 * Auth API service — typed wrappers around backend /api/auth/* endpoints.
 */
import { api } from '../lib/api';
import { authStorage } from '../lib/auth-storage';

export type BackendRole = 'consumer' | 'worker' | 'admin' | 'cco' | 'ops_manager' | 'fcco' | 'super_admin';
export type FrontendRole = 'family' | 'nurse';

export function toBackendRole(r: FrontendRole): BackendRole {
  return r === 'family' ? 'consumer' : 'worker';
}
export function toFrontendRole(r: BackendRole): FrontendRole {
  return r === 'worker' ? 'nurse' : 'family';
}

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

export const authService = {
  async sendOtp(phone: string, role: FrontendRole = 'family'): Promise<SendOtpResponse> {
    const cleanPhone = phone.replace(/\s+/g, '');
    return api.post<SendOtpResponse>(
      '/auth/send-otp',
      { phone_e164: cleanPhone, role: toBackendRole(role), purpose: 'login' },
      // @ts-expect-error custom flag for our interceptor
      { skipAuth: true }
    );
  },

  /**
   * Direct login (no OTP).
   * Minimal additive: backend `/auth/login` mints tokens from phone+role.
   * Persists tokens + user + role identically to the OTP path so the rest
   * of the app (Zustand, JWT refresh, secure storage) is unchanged.
   */
  async loginDirect(phone: string, role: FrontendRole, deviceId?: string): Promise<AuthResponse> {
    const cleanPhone = phone.replace(/\s+/g, '');
    const res = await api.post<AuthResponse>(
      '/auth/login',
      {
        phone_e164: cleanPhone,
        code: '',
        role: toBackendRole(role),
        device_id: deviceId,
        device_platform: 'expo',
      },
      // @ts-expect-error custom flag
      { skipAuth: true }
    );
    await authStorage.saveTokens(res.tokens.access_token, res.tokens.refresh_token);
    await authStorage.saveUser(res.user);
    await authStorage.saveRole(role);
    return res;
  },

  async verifyOtp(phone: string, code: string, role: FrontendRole, deviceId?: string): Promise<AuthResponse> {
    const cleanPhone = phone.replace(/\s+/g, '');
    const res = await api.post<AuthResponse>(
      '/auth/verify-otp',
      {
        phone_e164: cleanPhone,
        code,
        role: toBackendRole(role),
        device_id: deviceId,
        device_platform: 'expo',
      },
      // @ts-expect-error custom flag
      { skipAuth: true }
    );
    console.log("LOGIN RESPONSE:", JSON.stringify(res, null, 2));
    // Persist immediately
    await authStorage.saveTokens(res.tokens.access_token, res.tokens.refresh_token);
    await authStorage.saveUser(res.user);
    await authStorage.saveRole(role);
    return res;
  },

  async me(): Promise<BackendUser> {
    return api.get<BackendUser>('/auth/me');
  },

  async logout(): Promise<void> {
    const refresh = await authStorage.getRefreshToken();
    try {
      if (refresh) {
        await api.post(
          '/auth/logout',
          { refresh_token: refresh },
          // @ts-expect-error custom flag
          { skipAuth: true }
        );
      }
    } catch {
      // ignore – we'll clear locally regardless
    }
    await authStorage.clearAll();
  },

  async restoreSession(): Promise<BackendUser | null> {
    const token = await authStorage.getAccessToken();
    if (!token) return null;
    try {
      const u = await api.get<BackendUser>('/auth/me');
      await authStorage.saveUser(u);
      return u;
    } catch {
      // Either expired (interceptor already attempted refresh & cleared) or network down.
      // Return cached user as a soft fallback so UI doesn't hard-logout on offline.
      return await authStorage.getUser<BackendUser>();
    }
  },
};
