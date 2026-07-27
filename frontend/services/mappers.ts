/**
 * Backend ↔ Frontend type mappers.
 * Keeps the existing UI store contracts intact while routing backend data through.
 */
import type { Nurse, Booking, BookingStatus, NotificationItem, PaymentStatus } from '../types';
import { badgeToneFor } from '../lib/booking-domain';

export interface BackendWorker {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: string;
  gender: string | null;
  bio: string | null;
  years_of_experience: number;
  languages_spoken: string[] | null;
  specialisations: string[] | null;
  rating_average: string | number;
  rating_count: number;
  completed_visits_count: number;
  availability: string;
  base_city: string | null;
}

export interface BackendService {
  id: string;
  service_code: string;
  name: string;
  description: string | null;
  category: string;
  min_tier: string;
  duration_minutes: number;
  base_price: string | number;
  max_price: string | number | null;
  commission_pct: string | number;
  urgent_surge_pct: number;
  requires_prescription: boolean;
  billing_trigger: string;
  insurance_covered: boolean;
  icon: string | null;
  is_active: boolean;
}

export interface BackendBooking {
  id: string;
  booking_ref: string;
  consumer_id: string;
  patient_id: string;
  booking_type: string;
  service_id: string | null;
  package_id: string | null;
  worker_id: string | null;
  status: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_duration_minutes: number;
  is_urgent: boolean;
  address_snapshot: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; landmark?: string };
  latitude: string | number;
  longitude: string | number;
  base_amount: string | number;
  surge_amount: string | number;
  subsidy_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  payment_status: string;
  razorpay_order_id: string | null;
  special_instructions: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  accepted_at: string | null;
  created_at: string;
  // Proximity dispatch
  assignment_wave?: number | null;
  assignment_escalated_at?: string | null;
  distance_km?: number | null;
  /**
   * Enrichment the backend adds on the list/detail endpoints. Preferred over
   * client-side lookups — `service_name` in particular is resolved from
   * whichever of service/package the booking actually references.
   */
  patient_name?: string | null;
  service_name?: string | null;
  worker_name?: string | null;
}

export interface BackendNotification {
  id: string;
  channel: string;
  template_code: string | null;
  title: string | null;
  body: string | null;
  payload: any;
  status: string;
  read_at: string | null;
  created_at: string;
}

const toNum = (v: string | number | null | undefined, d = 0): number => {
  if (v === null || v === undefined) return d;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? d : n;
};

export function mapWorker(w: BackendWorker): Nurse {
  const genderNorm: 'Male' | 'Female' = w.gender === 'male' ? 'Male' : 'Female';
  return {
    id: w.id,
    name: w.full_name || 'Nurse Partner',
    avatar:
      w.avatar_url ||
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
    rating: toNum(w.rating_average) || 4.5,
    reviews: w.rating_count || 0,
    experienceYears: w.years_of_experience || 1,
    distanceKm: 1.5,
    hourlyRate: 450,
    gender: genderNorm,
    specializations: w.specialisations || ['General nursing'],
    languages: w.languages_spoken || ['English', 'Hindi'],
    about: w.bio || 'Experienced nurse partner.',
    available: w.availability === 'online',
    verified: true,
    certifications: [],
  };
}

export function mapBooking(
  b: BackendBooking,
  careTitleResolver?: (sid: string | null, pid: string | null) => string,
): Booking {
  const addr = b.address_snapshot || {};
  const addrStr = [addr.line1, addr.line2, addr.landmark, addr.city, addr.pincode]
    .filter(Boolean)
    .join(', ');
  const careTypeId = b.service_id || b.package_id || 'general';
  // Prefer the server's own label: it resolves whichever of service/package
  // the booking references, so it can never disagree with the catalogue.
  const careTitle =
    b.service_name ||
    (careTitleResolver ? careTitleResolver(b.service_id, b.package_id) : '') ||
    'Home nursing visit';

  const rawStatus = (b.status || 'draft') as BookingStatus;
  const time = (b.scheduled_start_time || '00:00:00').slice(0, 5);

  return {
    id: b.id,
    nurseId: b.worker_id || 'unassigned',
    nurseName: b.worker_name || (b.worker_id ? 'Your nurse' : 'Awaiting match'),
    nurseAvatar: '',
    careTypeId,
    careTitle,
    patientName: b.patient_name ?? undefined,
    date: b.scheduled_date,
    slot: time,
    duration: Math.max(1, Math.round((b.scheduled_duration_minutes || 60) / 60)),
    address: addrStr || 'Address on file',
    cost: toNum(b.total_amount),
    subsidy: toNum(b.subsidy_amount),
    netCost: Math.max(0, toNum(b.total_amount) - toNum(b.subsidy_amount)),
    status: badgeToneFor(rawStatus),
    rawStatus,
    paymentStatus: (b.payment_status || 'pending') as PaymentStatus,
    // Backend uses a Razorpay-aligned enum:
    // pending | initiated | captured | failed | refunded | partially_refunded
    paid: b.payment_status === 'captured' || b.payment_status === 'partially_refunded',
    createdAt: b.created_at,
    // The backend combines date + time as UTC, so mirror that here — building
    // it as a local instant would shift the 6-hour cancellation cutoff by the
    // device's timezone offset.
    scheduledStartISO: b.scheduled_date ? `${b.scheduled_date}T${time}:00Z` : undefined,
    isUrgent: !!b.is_urgent,
    notes: b.special_instructions || undefined,
    patientId: b.patient_id,
    bookingRef: b.booking_ref,
    serviceId: b.service_id,
    packageId: b.package_id,
    cancellationReason: b.cancellation_reason,
    acceptedAt: b.accepted_at,
    // Proximity dispatch surface for the distance chip + Maps deep link.
    distanceKm: typeof b.distance_km === 'number' ? b.distance_km : undefined,
    latitude: b.latitude !== null && b.latitude !== undefined ? toNum(b.latitude) : undefined,
    longitude: b.longitude !== null && b.longitude !== undefined ? toNum(b.longitude) : undefined,
  };
}

export function mapNotification(n: BackendNotification): NotificationItem {
  const created = n.created_at ? new Date(n.created_at) : new Date();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  let group: NotificationItem['group'] = 'Earlier';
  if (created.toDateString() === today) group = 'Today';
  else if (created.toDateString() === yesterday) group = 'Yesterday';
  const code = (n.template_code || '').toLowerCase();
  const type: NotificationItem['type'] = code.includes('pay')
    ? 'payment'
    : code.includes('book')
    ? 'booking'
    : code.includes('alert') || code.includes('escal')
    ? 'alert'
    : 'system';
  return {
    id: n.id,
    title: n.title || n.template_code || 'Notification',
    body: n.body || '',
    time: created.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
    group,
    type,
    read: !!n.read_at,
  };
}
