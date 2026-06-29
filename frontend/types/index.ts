export type Role = 'family' | 'nurse';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
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

export type VisitStatus =
  | 'scheduled'
  | 'enroute'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface Booking {
  id: string;
  nurseId: string;
  nurseName: string;
  nurseAvatar: string;
  careTypeId: string;
  careTitle: string;
  date: string; // ISO date
  slot: string; // e.g. "09:00 AM"
  duration: number; // hours
  address: string;
  notes?: string;
  cost: number;
  subsidy: number;
  netCost: number;
  status: VisitStatus;
  paid: boolean;
  paymentMethod?: string;
  createdAt: string;
  // Optional fields surfaced by backend mapper (used for booking-confirmed UI & tracking gate)
  patientId?: string;
  patientName?: string;
  bookingRef?: string;
  // Patch 3 — proximity dispatch + Google Maps deep link.
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
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
