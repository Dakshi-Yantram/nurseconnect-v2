/**
 * Realtime orchestrator (Phase 4).
 *
 * One process-wide user-socket. On login open, on logout close.
 * Forwards events to a single handler registered by the store, so the
 * store keeps full ownership of how each event hydrates state — we don't
 * recreate any Zustand structure here.
 */
import { createWS, WSHandle } from './ws';

export type RealtimeHandler = (event: any) => void;

let handle: WSHandle | null = null;
let bookingHandles: Record<string, WSHandle> = {};
let userHandler: RealtimeHandler | null = null;

export const realtime = {
  setHandler(fn: RealtimeHandler) {
    userHandler = fn;
  },
  connectUser() {
    if (handle) return;
    handle = createWS('/api/ws/user', {
      onMessage: (msg) => userHandler?.(msg),
    });
  },
  disconnectUser() {
    try {
      handle?.close();
    } catch {
      // ignore
    }
    handle = null;
  },
  /** Per-booking live tracking topic. Reuses if already open. */
  connectBooking(bookingId: string, onMessage: RealtimeHandler): WSHandle {
    const existing = bookingHandles[bookingId];
    if (existing) return existing;
    const h = createWS(`/api/ws/booking/${bookingId}`, { onMessage });
    bookingHandles[bookingId] = h;
    return h;
  },
  disconnectBooking(bookingId: string) {
    const h = bookingHandles[bookingId];
    if (h) {
      try {
        h.close();
      } catch {
        // ignore
      }
      delete bookingHandles[bookingId];
    }
  },
  disconnectAllBookings() {
    Object.keys(bookingHandles).forEach((id) => realtime.disconnectBooking(id));
  },
  isUserConnected(): boolean {
    return !!handle;
  },
};
