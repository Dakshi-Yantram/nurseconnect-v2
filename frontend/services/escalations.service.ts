import { api } from '../lib/api';

export type EscalationLevel = 'watch' | 'inform_family' | 'contact_doctor' | 'emergency';
export type EscalationStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated_further';

export interface EscalationOut {
  id: string;
  booking_id: string;
  visit_record_id: string | null;
  worker_id: string;
  patient_id: string;
  level: EscalationLevel;
  status: EscalationStatus;
  trigger_type: string;
  trigger_details: Record<string, any> | null;
  notes: string | null;
  notified_parties: string[] | null;
  sla_minutes: number | null;
  sla_breach_at: string | null;
  auto_call_112: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export const escalationsService = {
  open: () => api.get<EscalationOut[]>('/escalations/open'),
  all: (params?: { status?: EscalationStatus; booking_id?: string }) =>
    api.get<EscalationOut[]>('/escalations/', params ? { params } : undefined),
  acknowledge: (id: string) => api.post<EscalationOut>(`/escalations/${id}/acknowledge`),
  resolve: (id: string, resolution_notes: string) =>
    api.post<EscalationOut>(`/escalations/${id}/resolve`, { resolution_notes }),
};
