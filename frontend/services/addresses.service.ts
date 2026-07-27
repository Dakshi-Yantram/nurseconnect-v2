/**
 * Consumer address book — /api/consumers/me/addresses.
 *
 * A booking can either reference a saved address (`address_id`) or carry an
 * inline snapshot. Saved addresses are preferred: they carry the recipient
 * name/phone used when booking for someone else, and their stored lat/lng is
 * what the dispatch radius is measured from.
 */
import { api } from '../lib/api';

export interface ConsumerAddress {
  id: string;
  label: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  is_default: boolean;
}

export interface AddressInput {
  label?: string;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  landmark?: string | null;
  is_default?: boolean;
}

const BASE = '/consumers/me/addresses';

export const addressesService = {
  list: () => api.get<ConsumerAddress[]>(BASE),
  create: (payload: AddressInput) => api.post<ConsumerAddress>(BASE, payload),
  update: (id: string, payload: AddressInput) => api.put<ConsumerAddress>(`${BASE}/${id}`, payload),
  setDefault: (id: string) => api.post<ConsumerAddress>(`${BASE}/${id}/default`),
  remove: (id: string) => api.delete<{ deleted: boolean }>(`${BASE}/${id}`),
};

/** One-line rendering used in pickers and booking summaries. */
export function formatAddress(a: ConsumerAddress): string {
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode]
    .filter((p) => p && String(p).trim())
    .join(', ');
}
