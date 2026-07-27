/**
 * Consumer <-> nurse chat — /api/messages/*.
 *
 * The backend re-derives `can_send` from the live booking status on every
 * request, so always trust the value from the latest thread fetch rather than
 * caching a "closed" flag locally.
 */
import { api } from '../lib/api';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatThread {
  can_send: boolean;
  /** Populated only when `can_send` is false — safe to show verbatim. */
  disabled_reason: string | null;
  messages: ChatMessage[];
}

export const messagingService = {
  bookingThread: (bookingId: string) => api.get<ChatThread>(`/messages/booking/${bookingId}`),
  sendToBooking: (bookingId: string, body: string) =>
    api.post<ChatMessage>(`/messages/booking/${bookingId}`, { body }),

  packageThread: (packageBookingId: string) =>
    api.get<ChatThread>(`/messages/package/${packageBookingId}`),
  sendToPackage: (packageBookingId: string, body: string) =>
    api.post<ChatMessage>(`/messages/package/${packageBookingId}`, { body }),
};
