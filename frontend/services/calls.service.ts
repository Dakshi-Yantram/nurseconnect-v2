/**
 * In-app calling API — /api/bookings/{id}/call/* and device push registration.
 *
 * The backend brokers a Dyte meeting per booking and hands each side its own
 * short-lived participant auth token. The app never sees the Dyte API key.
 */
import { api } from '../lib/api';

export interface CallCredentials {
  call_session_id: string;
  dyte_meeting_id: string;
  /** Per-participant token — this is what the Dyte SDK is initialised with. */
  dyte_auth_token: string;
  dyte_org_id: string;
}

export type CallEndReason = 'completed' | 'no_answer' | 'declined' | 'failed';

export interface CallSessionOut {
  id: string;
  booking_id: string;
  dyte_meeting_id: string;
  initiated_by_role: 'consumer' | 'worker';
  status: 'ringing' | 'joined' | 'missed' | 'ended' | 'failed';
  started_at: string;
  callee_joined_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: CallEndReason | null;
}

/** Payload the backend sends over WebSocket / PushKit / FCM to ring a device. */
export interface IncomingCallPayload {
  type: 'incoming_call';
  booking_id: string;
  call_session_id: string;
  dyte_meeting_id: string;
  caller_name: string;
}

export const callsService = {
  /** Caller side. Also rings the callee on every device they're signed in on. */
  start: (bookingId: string) =>
    api.post<CallCredentials>(`/bookings/${bookingId}/call/start`),

  /** Callee side, after accepting. Joins the same meeting the caller created. */
  join: (bookingId: string, callSessionId: string) =>
    api.post<CallCredentials>(`/bookings/${bookingId}/call/${callSessionId}/join`),

  end: (bookingId: string, callSessionId: string, endReason: CallEndReason = 'completed') =>
    api.post<CallSessionOut>(`/bookings/${bookingId}/call/${callSessionId}/end`, {
      end_reason: endReason,
    }),

  /**
   * Register this install's push tokens so it can be rung while backgrounded.
   * iOS sends both: FCM for ordinary notifications, APNs VoIP for PushKit.
   */
  registerDevice: (payload: {
    device_id: string;
    platform: 'ios' | 'android';
    fcm_token?: string;
    apns_voip_token?: string;
  }) => api.post<{ registered: boolean; voip: boolean }>('/notifications/devices', payload),

  /** Called on sign-out so the handset stops ringing for this account. */
  unregisterDevice: (deviceId: string) =>
    api.delete<{ unregistered: boolean }>(`/notifications/devices/${deviceId}`),
};
