/**
 * Help centre — published FAQs plus the consumer/nurse support ticket flow.
 * Backed by /api/faqs and /api/tickets/*.
 *
 * Distinct from clinical escalations (escalations.service.ts): those are
 * patient-safety events raised during a visit, these are "I need help with
 * the app / my booking / my payout" tickets worked by the support team.
 */
import { api } from '../lib/api';

export interface Faq {
  id: string;
  audience: 'consumer' | 'worker' | 'all';
  category: string | null;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicketOut {
  id: string;
  ticket_ref: string;
  raised_by: string;
  raiser_name: string | null;
  raiser_role: string;
  category: string;
  subject: string;
  description: string;
  booking_id: string | null;
  status: TicketStatus;
  priority: string;
  assigned_to: string | null;
  assignee_name: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface SupportTicketDetail extends SupportTicketOut {
  messages: TicketMessage[];
}

export const TICKET_CATEGORIES = [
  { id: 'booking', label: 'Booking' },
  { id: 'payment', label: 'Payment' },
  { id: 'nurse', label: 'Care professional' },
  { id: 'app', label: 'App issue' },
  { id: 'other', label: 'Something else' },
] as const;

export const supportService = {
  /** Backend defaults the audience from the caller's role. */
  faqs: (audience?: 'consumer' | 'worker') =>
    api.get<Faq[]>('/faqs', audience ? { params: { audience } } : undefined),

  createTicket: (payload: {
    category: string;
    subject: string;
    description: string;
    booking_id?: string;
  }) => api.post<SupportTicketOut>('/tickets', payload),

  myTickets: () => api.get<SupportTicketOut[]>('/tickets/mine'),
  getTicket: (id: string) => api.get<SupportTicketDetail>(`/tickets/${id}`),
  addMessage: (id: string, message: string) =>
    api.post<{ id: string; created_at: string }>(`/tickets/${id}/messages`, { message }),
};
