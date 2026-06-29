/**
 * Offline-first queue (Phase 4 hardening).
 *
 * Additive changes:
 *  - Treats backend's idempotent-replay errors (HTTP 400 with specific messages
 *    like "Already checked in/out", "Already paid", "Visit already completed",
 *    "Already escalated") as SUCCESS during drain.
 *  - Drop after 6 attempts unchanged.
 *  - X-Idempotency-Key still emitted so backend dedupe can collapse retries.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

const QUEUE_KEY = 'nc_offline_queue_v1';

export type QueueOp = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface QueuedRequest {
  id: string; // idempotency key (uuid)
  op: QueueOp;
  url: string;
  body?: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

function uuid(): string {
  return 'oq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

async function readQueue(): Promise<QueuedRequest[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedRequest[];
  } catch {
    return [];
  }
}
async function writeQueue(q: QueuedRequest[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

// Idempotent-replay error fingerprints: if we hit these on retry, treat as success.
const IDEMPOTENT_REPLAY_PATTERNS: RegExp[] = [
  /already checked[- ]?in/i,
  /already checked[- ]?out/i,
  /already paid/i,
  /already complete/i,
  /already verified/i,
  /already submitted/i,
  /already acknowledged/i,
  /already resolved/i,
  /not in.*progress/i, // visit state already transitioned past
];

function isIdempotentReplay(err: any): boolean {
  if (!err) return false;
  if (err.status !== 400 && err.status !== 409) return false;
  const msg = (err.message || '') + ' ' + JSON.stringify(err.detail || '');
  return IDEMPOTENT_REPLAY_PATTERNS.some((re) => re.test(msg));
}

let draining = false;
let listeners: ((count: number) => void)[] = [];

export const offlineQueue = {
  async size(): Promise<number> {
    const q = await readQueue();
    return q.length;
  },
  onChange(fn: (count: number) => void): () => void {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },
  async enqueue(op: QueueOp, url: string, body?: any): Promise<QueuedRequest> {
    const item: QueuedRequest = {
      id: uuid(),
      op,
      url,
      body,
      createdAt: Date.now(),
      attempts: 0,
    };
    const q = await readQueue();
    q.push(item);
    await writeQueue(q);
    listeners.forEach((l) => l(q.length));
    return item;
  },
  async drain(): Promise<{ ok: number; failed: number; replayed: number }> {
    if (draining) return { ok: 0, failed: 0, replayed: 0 };
    draining = true;
    let ok = 0;
    let failed = 0;
    let replayed = 0;
    try {
      const q = await readQueue();
      const remaining: QueuedRequest[] = [];
      for (const item of q) {
        try {
          const headers = { 'X-Idempotency-Key': item.id };
          if (item.op === 'POST') await api.post(item.url, item.body, { headers });
          else if (item.op === 'PUT') await api.put(item.url, item.body, { headers });
          else if (item.op === 'PATCH') await api.patch(item.url, item.body, { headers });
          else if (item.op === 'DELETE') await api.delete(item.url, { headers });
          ok += 1;
        } catch (e: any) {
          if (isIdempotentReplay(e)) {
            // Backend already applied this op — drop silently.
            replayed += 1;
            continue;
          }
          item.attempts += 1;
          item.lastError = e?.message || 'sync_failed';
          if (item.attempts < 6) remaining.push(item);
          failed += 1;
        }
      }
      await writeQueue(remaining);
      listeners.forEach((l) => l(remaining.length));
    } finally {
      draining = false;
    }
    return { ok, failed, replayed };
  },
  async tryOrQueue<T>(
    op: QueueOp,
    url: string,
    body?: any
  ): Promise<{ queued: false; data: T } | { queued: true; id: string }> {
    try {
      let data: any;
      if (op === 'POST') data = await api.post(url, body);
      else if (op === 'PUT') data = await api.put(url, body);
      else if (op === 'PATCH') data = await api.patch(url, body);
      else if (op === 'DELETE') data = await api.delete(url);
      return { queued: false, data: data as T };
    } catch (e: any) {
      if (e?.network) {
        const item = await offlineQueue.enqueue(op, url, body);
        return { queued: true, id: item.id };
      }
      throw e;
    }
  },
};
