import { api } from '../lib/api';
import type { BackendBooking } from './mappers';

export interface AddressSnapshot {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface BookingCreatePayload {
  patient_id: string;
  service_id?: string;
  package_id?: string;
  booking_type?: 'one_time' | 'recurring' | 'shift' | 'package';
  scheduled_date: string; // YYYY-MM-DD
  scheduled_start_time: string; // HH:MM:SS
  is_urgent?: boolean;
  address: AddressSnapshot;
  latitude: number;
  longitude: number;
  special_instructions?: string;
  preferred_worker_id?: string;
}

export type EscalationLevel = 'watch' | 'inform_family' | 'contact_doctor' | 'emergency';

export interface BookingEscalatePayload {
  level: EscalationLevel;
  trigger_type?: string; // 'manual' | 'vital_threshold' | 'symptom' | ...
  notes: string;
  trigger_details?: Record<string, any>;
}

export const bookingsService = {
  create: (payload: BookingCreatePayload) => api.post<BackendBooking>('/bookings/', payload),
  listConsumer: (status?: string) =>
    api.get<BackendBooking[]>('/bookings/consumer', status ? { params: { status } } : undefined),
  listWorker: (status?: string) =>
    api.get<BackendBooking[]>('/bookings/worker', status ? { params: { status } } : undefined),
  newRequests: () => api.get<BackendBooking[]>('/bookings/worker/new-requests'),
  get: (id: string) => api.get<BackendBooking>(`/bookings/${id}`),
  accept: (id: string) => api.post<BackendBooking>(`/bookings/${id}/accept`),
  cancel: (id: string, reason: string) =>
    api.post<BackendBooking>(`/bookings/${id}/cancel`, { reason }),
  escalate: (id: string, payload: BookingEscalatePayload) =>
    api.post<{ id: string; level: string; status: string; sla_breach_at: string | null }>(
      `/bookings/${id}/escalate`,
      payload,
    ),
};
