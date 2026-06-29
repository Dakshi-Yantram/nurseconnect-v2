/**
 * Hardened WebSocket client.
 * Phase 4 enhancements (additive, no contract change):
 *  - Heartbeat ping every 25s; reconnect if 2 pongs missed
 *  - Exponential backoff with jitter (1s → 30s cap)
 *  - Duplicate-event prevention via per-socket LRU set of event ids
 *  - Foreground/background recovery via AppState (already present, now stable)
 *  - Token refresh on reconnect: re-reads from secure storage on every reconnect
 *  - Stale-socket cleanup: close() always nulls handle + clears timers
 */
import { AppState, AppStateStatus } from 'react-native';
import { authStorage } from './auth-storage';

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '').replace(/^http/, 'ws');

export interface WSHandle {
  close: () => void;
  send: (data: any) => void;
  readyState: () => number;
}

export interface WSOptions {
  onMessage?: (msg: any) => void;
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (err: any) => void;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  backgroundClose?: boolean;
  heartbeatMs?: number;
  dedupLimit?: number;
}

export function createWS(path: string, opts: WSOptions = {}): WSHandle {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectIntervalMs = 1000,
    maxReconnectAttempts = 20,
    backgroundClose = true,
    heartbeatMs = 25000,
    dedupLimit = 200,
  } = opts;

  let ws: WebSocket | null = null;
  let attempts = 0;
  let manuallyClosed = false;
  let appStateSub: any = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pongMissed = 0;
  const seen: string[] = []; // LRU of event ids for dedup

  const clearTimers = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (manuallyClosed || attempts >= maxReconnectAttempts) return;
    attempts += 1;
    const base = Math.min(reconnectIntervalMs * Math.pow(2, attempts - 1), 30000);
    const jitter = Math.floor(Math.random() * 300);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, base + jitter);
  };

  const isDuplicate = (data: any): boolean => {
    const id = data?.event_id || data?.id;
    if (!id) return false;
    if (seen.includes(id)) return true;
    seen.push(id);
    if (seen.length > dedupLimit) seen.shift();
    return false;
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    pongMissed = 0;
    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        pongMissed += 1;
        if (pongMissed >= 3) {
          // Force a reconnect — socket appears stale
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      } catch {
        // noop; onclose will fire
      }
    }, heartbeatMs);
  };

  async function connect() {
    // Re-read token on every connect (handles refresh-while-offline)
    const token = await authStorage.getAccessToken();
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`;
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        attempts = 0;
        pongMissed = 0;
        startHeartbeat();
        onOpen?.();
      };
      ws.onmessage = (ev) => {
        let data: any;
        try {
          data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        } catch {
          data = ev.data;
        }
        // Server may send pong; reset missed counter
        if (data && (data.type === 'pong' || data.type === 'ping')) {
          pongMissed = 0;
          return;
        }
        if (isDuplicate(data)) return;
        onMessage?.(data);
      };
      ws.onerror = (e) => onError?.(e);
      ws.onclose = (ev) => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        onClose?.(ev as CloseEvent);
        if (!manuallyClosed) scheduleReconnect();
      };
    } catch (e) {
      onError?.(e);
      scheduleReconnect();
    }
  }

  connect();

  if (backgroundClose) {
    const handler = (state: AppStateStatus) => {
      if (state === 'background') {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      } else if (state === 'active' && !manuallyClosed) {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          attempts = 0; // foreground = quick reconnect
          connect();
        }
      }
    };
    appStateSub = AppState.addEventListener('change', handler);
  }

  return {
    close: () => {
      manuallyClosed = true;
      clearTimers();
      appStateSub?.remove?.();
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
    },
    send: (data: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      }
    },
    readyState: () => ws?.readyState ?? WebSocket.CLOSED,
  };
}
