import type { AppRole } from '../lib/roles';

export type Role = AppRole;

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  /** Backend account state: active | onboarding | pending_verification | ... */
  status?: string;
  abhaId?: string;
  avatar?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  conditions?: string[];
}

export interface Nurse {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  experienceYears: number;
  distanceKm: number;
  hourlyRate: number;
  gender: 'Male' | 'Female';
  specializations: string[];
  languages: string[];
  about: string;
  available: boolean;
  verified: boolean;
  certifications: string[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface CareType {
  id: string;
  title: string;
  description: string;
  iconLib: 'FontAwesome5' | 'MaterialCommunityIcons' | 'Ionicons';
  icon: string;
  color: string;
  estimatedHours: number;
  baseRate: number;
}

/** Coarse UI status used for badges and colours. */
export type VisitStatus =
  | 'scheduled'
  | 'enroute'
  | 'active'
  | 'completed'
  | 'cancelled';

/**
 * The backend's `BookingStatus` enum, verbatim. Bucketing and gating must key
 * off this rather than the coarse `VisitStatus` above — collapsing statuses
 * loses `rematch_pending` (re-offered after a nurse cancelled) and `disputed`,
 * both of which previously fell through every filter and vanished from the UI.
 */
export type BookingStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'assigned'
  | 'worker_en_route'
  | 'worker_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'missed'
  | 'rematch_pending'
  | 'disputed'
  // Composite Care Package (material_included) states — Workflow 1.
  | 'prescription_pending'
  | 'searching_nurse'
  | 'quality_discrepancy_alert';

export type PaymentStatus =
  | 'pending'
  | 'initiated'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Booking {
  id: string;
  nurseId: string;
  nurseName: string;
  nurseAvatar: string;
  careTypeId: string;
  careTitle: string;
  date: string; // YYYY-MM-DD
  slot: string; // "HH:MM"
  duration: number; // hours
  address: string;
  notes?: string;
  cost: number;
  subsidy: number;
  netCost: number;
  status: VisitStatus;
  /** Untouched backend status — always prefer this for logic. */
  rawStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  paid: boolean;
  paymentMethod?: string;
  createdAt: string;
  /** Scheduled start as a real instant, for the 6-hour cancellation window. */
  scheduledStartISO?: string;
  isUrgent?: boolean;
  patientId?: string;
  patientName?: string;
  bookingRef?: string;
  serviceId?: string | null;
  packageId?: string | null;
  cancellationReason?: string | null;
  acceptedAt?: string | null;
  // Proximity dispatch + Google Maps deep link.
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  /** Composite Care Package (bundled procedural kit) — Workflow 1. */
  materialIncluded?: boolean;
  /** Service-Only, patient supplies their own materials — Workflow 2. */
  serviceOnlyWorkflow?: boolean;
  /** Either guarded workflow — both run the synchronized safety checklist. */
  guardedWorkflow?: boolean;
  /** Workflow 2 — patient's tick-list of what they say they have ready. */
  patientSupplyConfirmation?: Record<string, boolean> | null;
  /** Workflow 2 — photo of the patient's own supplies, taken at booking time. */
  patientSupplyPhotoUrl?: string | null;
}

export interface VisitTimelineStep {
  key: string;
  label: string;
  time?: string;
  done: boolean;
}

export interface Vitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  glucose?: string;
}

export interface CareNote {
  bookingId: string;
  vitals: Vitals;
  medications: { name: string; dose: string; time: string }[];
  observations: string;
  followUp: boolean;
  followUpNote?: string;
  patientResponse: string;
  completedAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string; // human or ISO
  group: 'Today' | 'Yesterday' | 'Earlier';
  type: 'booking' | 'payment' | 'alert' | 'system';
  read: boolean;
}

export interface KitItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  checked: boolean;
}

export type ABHACategory = 'discharge' | 'lab' | 'prescription' | 'radiology';

export interface ABHARecord {
  id: string;
  hospital: string;
  type: string;
  category: ABHACategory;
  date: string;
  doctor: string;
  summary?: string;
  fileSize?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: 'booking' | 'payment' | 'nurse' | 'app' | 'other';
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updates: { time: string; message: string; from: 'you' | 'support' }[];
}

export type EscalationSeverity = 'watch' | 'inform_family' | 'contact_doctor' | 'emergency';

export interface Escalation {
  id: string;
  visitId: string;
  severity: EscalationSeverity;
  symptoms: string[];
  notes: string;
  vitals?: Vitals;
  createdAt: string;
  notifiedFamily: boolean;
  notifiedAdmin: boolean;
  status: 'active' | 'resolved';
}

export interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  durationMins: number;
  modules: number;
  completed: number;
  status: 'completed' | 'in_progress' | 'not_started';
  thumbnail: string;
}

export interface Certificate {
  id: string;
  title: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate?: string;
  certNumber: string;
  status: 'active' | 'expiring' | 'expired';
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  date: string;
  service: string;
  amount: number;
  subsidy: number;
  net: number;
  method: string;
  status: 'paid' | 'failed' | 'pending';
}
