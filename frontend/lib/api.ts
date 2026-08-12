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

/**
 * Upload endpoints (e.g. clinical photo documentation) return a *relative*
 * `/api/uploads/...` path so the backend never has to know its own public
 * host. Screens rendering that path as an <Image> need the full origin —
 * without it RN resolves the string as a bare relative URL and the image
 * simply never loads (no error, just a blank box), which historically read
 * as "upload succeeded but I can't see my photo".
 */
export function resolveMediaUrl(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!BASE_URL) return pathOrUrl; // web dev server: relative path resolves fine
  return `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

if (!BASE_URL && __DEV__) {
  // A relative "/api" only resolves when the app is served from the same
  // origin as the backend (i.e. `expo start --web`). On a device or simulator
  // every request fails with an opaque network error, which is very hard to
  // diagnose from the UI — so say it plainly at startup.
  console.warn(
    '[NurseConnect] EXPO_PUBLIC_BACKEND_URL is not set — API calls will fail on a device. ' +
      'Copy .env.example to .env and point it at your backend.',
  );
}

export interface APIError {
  status: number;
  message: string;
  detail?: unknown;
  network?: boolean;
}

/**
 * Our request config adds `skipAuth` for the auth endpoints, which must not
 * carry a stale (or about-to-be-rotated) Authorization header.
 */
export interface NCRequestConfig extends InternalAxiosRequestConfig {
  skipAuth?: boolean;
  _retry?: boolean;
}

/**
 * FastAPI validation errors come back as `{ detail: [{ loc, msg, type }, ...] }`
 * — an array, not a string. Turn that into a readable "field: message" line
 * instead of silently discarding it.
 */
function stringifyValidationErrors(list: any[]): string | null {
  try {
    const parts = list
      .map((item) => {
        const field = Array.isArray(item?.loc) ? item.loc.filter((p: any) => p !== 'body').join('.') : null;
        const msg = typeof item?.msg === 'string' ? item.msg : null;
        if (field && msg) return `${field}: ${msg}`;
        return msg || null;
      })
      .filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  } catch {
    return null;
  }
}

function normaliseError(err: unknown): APIError {
  const e = err as AxiosError<any>;
  if (e.response) {
    const rawDetail = e.response.data?.detail ?? e.response.data?.message ?? e.response.statusText;
    let message: string | null = null;

    if (typeof rawDetail === 'string') {
      message = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      // e.g. FastAPI 422 validation errors — surface the real field/reason
      // instead of collapsing to a generic message.
      message = stringifyValidationErrors(rawDetail);
    } else if (rawDetail && typeof rawDetail === 'object' && 'message' in rawDetail) {
      message = (rawDetail as any).message;
    } else if (rawDetail && typeof rawDetail === 'object') {
      // Unknown object shape — still better than hiding it entirely.
      try {
        message = JSON.stringify(rawDetail);
      } catch {
        message = null;
      }
    }

    return {
      status: e.response.status,
      // Always keep the HTTP status visible so "Request failed" (if it ever
      // shows) can at least be traced back to a status code in a screenshot.
      message: message || `Request failed (${e.response.status})`,
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
client.interceptors.request.use(async (config: NCRequestConfig) => {
  // Allow opt-out via flag (e.g. auth endpoints don't need an existing token)
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
    const cfg = error.config as NCRequestConfig | undefined;
    if (error.response?.status === 401 && cfg && !cfg._retry && !cfg.skipAuth) {
      cfg._retry = true;
      // Single-flight: the backend rotates (and revokes) the refresh token on
      // every use, so two parallel refreshes would invalidate each other and
      // sign the user out. Clearing the slot inside `finally` — rather than
      // after the await — keeps every concurrent caller on the same promise.
      if (!refreshInFlight) {
        refreshInFlight = performRefresh().finally(() => {
          refreshInFlight = null;
        });
      }
      const newToken = await refreshInFlight;
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

/** Public request options — plain axios config plus our `skipAuth` flag. */
export type RequestOptions = AxiosRequestConfig & { skipAuth?: boolean };

export const api = {
  get: <T = any>(url: string, config?: RequestOptions) =>
    client.get<T>(url, config).then((r) => r.data),
  post: <T = any>(url: string, body?: any, config?: RequestOptions) =>
    client.post<T>(url, body, config).then((r) => r.data),
  put: <T = any>(url: string, body?: any, config?: RequestOptions) =>
    client.put<T>(url, body, config).then((r) => r.data),
  patch: <T = any>(url: string, body?: any, config?: RequestOptions) =>
    client.patch<T>(url, body, config).then((r) => r.data),
  delete: <T = any>(url: string, config?: RequestOptions) =>
    client.delete<T>(url, config).then((r) => r.data),

  /**
   * Multipart upload for the document / photo endpoints. React Native's
   * FormData needs the `{ uri, name, type }` shape, and the boundary must be
   * left to the runtime — setting Content-Type by hand breaks the upload.
   */
  upload: <T = any>(
    url: string,
    file: { uri: string; name: string; type: string },
    fields?: Record<string, string>,
    fileField = 'file',
  ) => {
    const form = new FormData();
    form.append(fileField, file as any);
    for (const [k, v] of Object.entries(fields ?? {})) form.append(k, v);
    return client
      .post<T>(url, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      .then((r) => r.data);
  },
};

export { client as rawClient };