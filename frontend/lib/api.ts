/**
 * Production HTTP client.
 * Features:
 *  - Auto-attach JWT access token from secure storage
 *  - Auto-refresh on 401 with single in-flight refresh (queue concurrent requests)
 *  - Centralised error normalisation
 *  - Configurable base URL via EXPO_PUBLIC_BACKEND_URL
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { authStorage } from './auth-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
export const API_BASE = BASE_URL ? `${BASE_URL}/api` : '/api';

export interface APIError {
  status: number;
  message: string;
  detail?: unknown;
  network?: boolean;
}

function normaliseError(err: unknown): APIError {
  const e = err as AxiosError<any>;
  if (e.response) {
    const detail = e.response.data?.detail || e.response.data?.message || e.response.statusText;
    return {
      status: e.response.status,
      message: typeof detail === 'string' ? detail : 'Request failed',
      detail: e.response.data,
    };
  }
  if (e.request) {
    return { status: 0, message: 'Network unavailable. Please check your connection.', network: true };
  }
  return { status: -1, message: (e as Error).message || 'Unknown error' };
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- REQUEST: attach access token ----
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Allow opt-out via flag (e.g. auth endpoints don't need an existing token)
  // @ts-expect-error custom flag
  if (config.skipAuth) return config;
  const token = await authStorage.getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- REFRESH QUEUE (single-flight) ----
let refreshInFlight: Promise<string | null> | null = null;
let onAuthFailure: (() => void) | null = null;

export function registerAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = await authStorage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(
      `${API_BASE}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (data?.access_token && data?.refresh_token) {
      await authStorage.saveTokens(data.access_token, data.refresh_token);
      return data.access_token as string;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- RESPONSE: handle 401 with refresh ----
client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = error.config as InternalAxiosRequestConfig & { _retry?: boolean; skipAuth?: boolean };
    if (error.response?.status === 401 && cfg && !cfg._retry && !cfg.skipAuth) {
      cfg._retry = true;
      if (!refreshInFlight) refreshInFlight = performRefresh();
      const newToken = await refreshInFlight;
      refreshInFlight = null;
      if (newToken) {
        cfg.headers = cfg.headers || {};
        (cfg.headers as any).Authorization = `Bearer ${newToken}`;
        return client(cfg);
      }
      // Refresh failed → clear + bubble up
      await authStorage.clearAll();
      onAuthFailure?.();
    }
    return Promise.reject(normaliseError(error));
  }
);

export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    client.get<T>(url, config).then((r) => r.data),
  post: <T = any>(url: string, body?: any, config?: AxiosRequestConfig) =>
    client.post<T>(url, body, config).then((r) => r.data),
  put: <T = any>(url: string, body?: any, config?: AxiosRequestConfig) =>
    client.put<T>(url, body, config).then((r) => r.data),
  patch: <T = any>(url: string, body?: any, config?: AxiosRequestConfig) =>
    client.patch<T>(url, body, config).then((r) => r.data),
  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    client.delete<T>(url, config).then((r) => r.data),
};

export { client as rawClient };
