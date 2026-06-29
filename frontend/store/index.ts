import { create } from 'zustand';
import {
  Booking,
  NotificationItem,
  KitItem,
  Role,
  User,
  VisitStatus,
  CareNote,
  ABHARecord,
  SupportTicket,
  Escalation,
  TrainingCourse,
  Certificate,
  Nurse,
} from '../types';
import { NURSES } from '../mock-data/nurses';
import { NOTIFICATIONS } from '../mock-data/notifications';
import { KIT_ITEMS } from '../mock-data/kit';
import {
  ABHA_RECORDS,
  SUPPORT_TICKETS,
  TRAINING_COURSES,
  CERTIFICATES,
} from '../mock-data/abha';

const seedFamilyBookings = (): Booking[] => {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  return [
    {
      id: 'b1',
      nurseId: 'n1',
      nurseName: NURSES[0].name,
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'wound',
      careTitle: 'Wound Care',
      date: today.toISOString(),
      slot: '10:00 AM',
      duration: 1,
      address: 'Flat 401, Sapphire Heights, Bandra West',
      cost: 450,
      subsidy: 90,
      netCost: 360,
      status: 'enroute',
      paid: true,
      paymentMethod: 'UPI',
      createdAt: today.toISOString(),
      notes: 'Post-op suture site care',
    },
    {
      id: 'b2',
      nurseId: 'n2',
      nurseName: NURSES[1].name,
      nurseAvatar: NURSES[1].avatar,
      careTypeId: 'elderly',
      careTitle: 'Elderly Care',
      date: tomorrow.toISOString(),
      slot: '08:30 AM',
      duration: 4,
      address: 'Flat 401, Sapphire Heights, Bandra West',
      cost: 1400,
      subsidy: 280,
      netCost: 1120,
      status: 'scheduled',
      paid: true,
      paymentMethod: 'Card',
      createdAt: today.toISOString(),
    },
    {
      id: 'b3',
      nurseId: 'n3',
      nurseName: NURSES[2].name,
      nurseAvatar: NURSES[2].avatar,
      careTypeId: 'vitals',
      careTitle: 'Vitals Monitoring',
      date: yesterday.toISOString(),
      slot: '06:00 PM',
      duration: 1,
      address: 'Flat 401, Sapphire Heights, Bandra West',
      cost: 300,
      subsidy: 60,
      netCost: 240,
      status: 'completed',
      paid: true,
      paymentMethod: 'UPI',
      createdAt: yesterday.toISOString(),
    },
  ];
};

const seedNurseAssignments = (): Booking[] => {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  return [
    {
      id: 'a1',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'wound',
      careTitle: 'Wound Care – Mr. Aggarwal',
      date: today.toISOString(),
      slot: '10:00 AM',
      duration: 1,
      address: 'Flat 12B, Greenwood Society, Powai',
      cost: 450,
      subsidy: 0,
      netCost: 450,
      status: 'scheduled',
      paid: true,
      createdAt: today.toISOString(),
      notes: 'Diabetic foot ulcer dressing',
    },
    {
      id: 'a2',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'vitals',
      careTitle: 'Vitals – Mrs. Kapoor',
      date: today.toISOString(),
      slot: '02:00 PM',
      duration: 1,
      address: 'Bungalow 7, Hiranandani Gardens',
      cost: 300,
      subsidy: 0,
      netCost: 300,
      status: 'scheduled',
      paid: true,
      createdAt: today.toISOString(),
    },
    {
      id: 'a3',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'elderly',
      careTitle: 'Elderly Care – Mr. Rao',
      date: tomorrow.toISOString(),
      slot: '09:00 AM',
      duration: 4,
      address: 'Flat 5, Sea Breeze, Worli',
      cost: 1400,
      subsidy: 0,
      netCost: 1400,
      status: 'scheduled',
      paid: true,
      createdAt: today.toISOString(),
    },
    {
      id: 'a4',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'medication',
      careTitle: 'Medication – Mrs. Iyengar',
      date: yesterday.toISOString(),
      slot: '11:30 AM',
      duration: 1,
      address: 'Flat 14, Marine Heights, Marine Drive',
      cost: 350,
      subsidy: 0,
      netCost: 350,
      status: 'completed',
      paid: true,
      createdAt: yesterday.toISOString(),
      notes: 'Insulin administration',
    },
    {
      id: 'a5',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'post-surgery',
      careTitle: 'Post-Surgery – Mr. Khan',
      date: twoDaysAgo.toISOString(),
      slot: '04:00 PM',
      duration: 2,
      address: 'Bungalow 22, Versova Beach Rd',
      cost: 900,
      subsidy: 0,
      netCost: 900,
      status: 'completed',
      paid: true,
      createdAt: twoDaysAgo.toISOString(),
    },
  ];
};

const seedNurseRequests = (): Booking[] => {
  const today = new Date();
  return [
    {
      id: 'r1',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'post-surgery',
      careTitle: 'Post-Surgery – Mr. Iyer',
      date: today.toISOString(),
      slot: '06:00 PM',
      duration: 4,
      address: 'Flat 9A, Lotus Tower, Goregaon',
      cost: 2200,
      subsidy: 0,
      netCost: 2200,
      status: 'scheduled',
      paid: false,
      createdAt: today.toISOString(),
      notes: 'Recovery from cardiac bypass',
    },
    {
      id: 'r2',
      nurseId: 'me',
      nurseName: 'You',
      nurseAvatar: NURSES[0].avatar,
      careTypeId: 'medication',
      careTitle: 'Medication – Mrs. Joshi',
      date: today.toISOString(),
      slot: '08:00 PM',
      duration: 1,
      address: 'Flat 22, Ocean View, Versova',
      cost: 250,
      subsidy: 0,
      netCost: 250,
      status: 'scheduled',
      paid: false,
      createdAt: today.toISOString(),
    },
  ];
};

interface AppState {
  // auth
  user: User | null;
  role: Role;
  authBootstrapping: boolean;
  setRole: (role: Role) => void;
  login: (phone: string, name?: string) => void;
  setUserFromBackend: (u: { id: string; phone_e164: string; full_name?: string | null; email?: string | null; role: string; avatar_url?: string | null }) => void;
  bootstrapSession: () => Promise<void>;
  logout: () => Promise<void>;

  // family
  bookings: Booking[];
  draftBooking: Partial<Booking> | null;
  setDraftBooking: (b: Partial<Booking> | null) => void;
  addBooking: (b: Booking) => void;
  updateBookingStatus: (id: string, status: VisitStatus) => void;

  // Phase 2: backend-driven family data
  nurses: import('../types').Nurse[];
  services: import('../services/mappers').BackendService[];
  patients: import('../services/users.service').PatientOut[];
  familyMembers: import('../services/users.service').FamilyMemberOut[];
  loadingNurses: boolean;
  loadingBookings: boolean;
  loadingNotifications: boolean;
  loadingServices: boolean;
  apiError: string | null;
  bootstrapFamily: () => Promise<void>;
  bootstrapNurse: () => Promise<void>;
  refreshAssignmentsAPI: () => Promise<void>;
  refreshNewRequestsAPI: () => Promise<void>;
  acceptAssignmentAPI: (id: string) => Promise<void>;
  cancelAssignmentAPI: (id: string, reason: string) => Promise<void>;
  startVisitAPI: (id: string, lat: number, lng: number) => Promise<void>;
  submitVitalsAPI: (bookingId: string, v: { bp_systolic?: number; bp_diastolic?: number; pulse?: number; temperature?: string; spo2?: number; glucose?: number }) => Promise<void>;
  logMedicationAPI: (bookingId: string, m: { medication_name: string; dose?: string; notes?: string }) => Promise<void>;
  completeVisitAPI: (id: string, careNote: CareNote, summary?: string) => Promise<void>;
  submitEscalationAPI: (bookingId: string, level: 'watch' | 'inform_family' | 'contact_doctor' | 'emergency', notes: string, symptoms?: string[]) => Promise<void>;
  loadEscalationsAPI: () => Promise<void>;
  loadTrainingAPI: () => Promise<void>;
  loadCertificatesAPI: () => Promise<void>;
  loadKitAPI: () => Promise<void>;
  toggleKitAPI: (kitId: string) => Promise<void>;
  submitChecklistAPI: (bookingId: string, responses: Record<string, any>) => Promise<void>;
  loadCareNotesAPI: (patientId: string) => Promise<any[]>;
  loadEarningsAPI: () => Promise<void>;
  updateAvailabilityAPI: (status: 'online' | 'offline' | 'busy' | 'on_leave') => Promise<void>;

  // ===== Phase 4: Realtime, Payments, Final Stabilization =====
  realtimeConnected: boolean;
  connectRealtime: () => void;
  disconnectRealtime: () => void;
  /** Internal — invoked by the realtime orchestrator on each WS frame. */
  handleRealtimeEvent: (event: any) => void;

  paymentHistory: import('../services/payments.service').PaymentHistoryItem[];
  initiatePaymentAPI: (
    bookingId: string,
  ) => Promise<import('../services/payments.service').BackendPaymentOrder>;
  verifyPaymentAPI: (
    payload: import('../services/payments.service').PaymentVerifyPayload,
  ) => Promise<{ verified: boolean }>;
  loadPaymentHistoryAPI: () => Promise<void>;

  submitAssessmentAPI: (
    moduleId: string,
    answers: number[],
  ) => Promise<import('../services/training.service').AssessmentSubmitResult>;
  // ===== END Phase 4 slice =====
  earnings: import('../services/worker-self.service').EarningsOut | null;
  pendingSyncCount: number;
  refreshPendingSync: () => Promise<void>;
  drainOfflineQueue: () => Promise<void>;
  loadServices: () => Promise<void>;
  searchNurses: (params?: import('../services/workers.service').WorkerSearchParams) => Promise<void>;
  refreshBookings: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loadPatients: () => Promise<void>;
  loadFamilyMembers: () => Promise<void>;
  createBookingAPI: (payload: import('../services/bookings.service').BookingCreatePayload) => Promise<Booking>;
  cancelBookingAPI: (id: string, reason: string) => Promise<void>;
  setApiError: (msg: string | null) => void;

  // nurse
  assignments: Booking[];
  newRequests: Booking[];
  acceptRequest: (id: string) => void;
  declineRequest: (id: string) => void;
  startVisit: (id: string) => void;
  completeVisit: (id: string, careNote: CareNote) => void;
  careNotes: Record<string, CareNote>;

  // notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;

  // kit
  kit: KitItem[];
  toggleKit: (id: string) => void;

  // offline
  isOffline: boolean;
  pendingSync: number;
  setOffline: (v: boolean) => void;
  triggerSync: () => void;

  // ABHA
  abhaRecords: ABHARecord[];
  addAbhaRecord: (r: ABHARecord) => void;

  // Support
  tickets: SupportTicket[];
  addTicket: (t: SupportTicket) => void;
  appendTicketUpdate: (id: string, msg: string) => void;

  // Escalations
  escalations: Escalation[];
  addEscalation: (e: Escalation) => void;
  resolveEscalation: (id: string) => void;

  // Training
  courses: TrainingCourse[];
  advanceCourse: (id: string) => void;

  // User profile updates
  updateUser: (patch: Partial<User>) => void;

  // Availability (nurse)
  availability: { [day: string]: boolean };
  toggleAvailability: (day: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  role: 'family',
  authBootstrapping: true,
  setRole: (role) => set({ role }),
  login: (phone, name) =>
    set({
      user: {
        id: 'u1',
        name: name || 'Aarav Kumar',
        phone,
        email: 'aarav@example.com',
        role: get().role,
        abhaId: '14-1234-5678-9012',
        avatar:
          'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80',
      },
    }),
  setUserFromBackend: (u) => {
    const fRole: Role = u.role === 'worker' ? 'nurse' : 'family';
    set({
      role: fRole,
      user: {
        id: u.id,
        name: u.full_name || (fRole === 'nurse' ? 'Nurse Partner' : 'Family Member'),
        phone: u.phone_e164,
        email: u.email || '',
        role: fRole,
        abhaId: '',
        avatar:
          u.avatar_url ||
          (fRole === 'nurse'
            ? 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80'
            : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80'),
      },
    });
  },
  bootstrapSession: async () => {
    try {
      const { authService } = await import('../services/auth.service');
      const u = await authService.restoreSession();
      if (u) {
        get().setUserFromBackend(u as any);
        // Hydrate role-specific data
        const r = get().role;
        if (r === 'family') {
          get().bootstrapFamily().catch(() => { });
        } else {
          get().bootstrapNurse().catch(() => { });
        }
        // Phase 4: realtime user socket + drain any pending offline ops
        get().connectRealtime?.();
        get().drainOfflineQueue?.().catch(() => { });
      }
    } catch {
      // Silent fallback to logged-out
    } finally {
      set({ authBootstrapping: false });
    }
  },
  logout: async () => {
    try {
      const { authService } = await import('../services/auth.service');
      await authService.logout();
    } catch {
      // ignore network/refresh failures - we clear locally
    }
    // Phase 4: tear down realtime cleanly
    get().disconnectRealtime?.();
    set({ user: null });
  },

  bookings: seedFamilyBookings(),
  draftBooking: null,
  setDraftBooking: (b) => set({ draftBooking: b }),
  addBooking: (b) => set({ bookings: [b, ...get().bookings] }),
  updateBookingStatus: (id, status) =>
    set({
      bookings: get().bookings.map((bk) => (bk.id === id ? { ...bk, status } : bk)),
      assignments: get().assignments.map((bk) =>
        bk.id === id ? { ...bk, status } : bk
      ),
    }),

  // ===== Phase 2: Backend-driven state slice =====
  nurses: NURSES,
  services: [],
  patients: [],
  familyMembers: [],
  loadingNurses: false,
  loadingBookings: false,
  loadingNotifications: false,
  loadingServices: false,
  apiError: null,
  setApiError: (msg) => set({ apiError: msg }),

  loadServices: async () => {
    set({ loadingServices: true });
    try {
      const { catalogService } = await import('../services');
      const list = await catalogService.listServices();
      set({ services: list });
    } catch (e: any) {
      set({ apiError: e?.message || 'Failed to load services' });
    } finally {
      set({ loadingServices: false });
    }
  },

  searchNurses: async (params) => {
    set({ loadingNurses: true });
    try {
      const { workersService, mapWorker } = await import('../services');
      const list = await workersService.search(params || {});
      const mapped = list.map((w) => mapWorker(w)) as Nurse[];
      // Keep existing rich mock data merged for richer UI fallback if backend list is short
      if (mapped.length > 0) {
        set({ nurses: mapped });
      }
    } catch (e: any) {
      // Don't wipe existing nurses on failure – keep cached/mocks
      set({ apiError: e?.message || null });
    } finally {
      set({ loadingNurses: false });
    }
  },

  refreshBookings: async () => {
    set({ loadingBookings: true });
    try {
      const { bookingsService, mapBooking } = await import('../services');
      const list = await bookingsService.listConsumer();
      const services = get().services;
      const titleFor = (sid: string | null) => services.find((s) => s.id === sid)?.name || 'Home Nursing Visit';
      const mapped = list.map((b: any) => mapBooking(b, (sid) => titleFor(sid)));
      // Merge: real bookings first, fall back to mock for empty state demo
      if (mapped.length > 0) {
        set({ bookings: mapped });
      }
    } catch (e: any) {
      set({ apiError: e?.message || null });
    } finally {
      set({ loadingBookings: false });
    }
  },

  refreshNotifications: async () => {
    set({ loadingNotifications: true });
    try {
      const { notificationsService, mapNotification } = await import('../services');
      const list = await notificationsService.list();
      const mapped = list.map(mapNotification);
      // Merge with existing seeded notifications so demo data remains
      set((s) => ({
        notifications: [
          ...mapped,
          ...s.notifications.filter((n) => !mapped.find((m: any) => m.id === n.id)),
        ],
      }));
    } catch (e: any) {
      set({ apiError: e?.message || null });
    } finally {
      set({ loadingNotifications: false });
    }
  },

  loadPatients: async () => {
    try {
      const { usersService } = await import('../services');
      const list = await usersService.listPatients();
      set({ patients: list });
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  loadFamilyMembers: async () => {
    try {
      const { usersService } = await import('../services');
      const list = await usersService.listFamilyMembers();
      set({ familyMembers: list });
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  createBookingAPI: async (payload) => {
    const { bookingsService, mapBooking } = await import('../services');
    const created = await bookingsService.create(payload);
    const services = get().services;
    const titleFor = (sid: string | null) => services.find((s) => s.id === sid)?.name || 'Home Nursing Visit';
    const mapped = mapBooking(created as any, titleFor);
    set({ bookings: [mapped, ...get().bookings.filter((b) => b.id !== mapped.id)] });
    return mapped;
  },

  cancelBookingAPI: async (id, reason) => {
    const { bookingsService } = await import('../services');
    await bookingsService.cancel(id, reason);
    set({
      bookings: get().bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
    });
  },

  bootstrapFamily: async () => {
    // Fire all family-side loaders in parallel
    await Promise.allSettled([
      get().loadServices(),
      get().searchNurses(),
      get().refreshBookings(),
      get().refreshNotifications(),
      get().loadPatients(),
      get().loadFamilyMembers(),
    ]);
  },
  // ===== END Phase 2 slice =====

  // ===== Phase 3: Nurse-side backend actions =====
  earnings: null,
  pendingSyncCount: 0,

  refreshPendingSync: async () => {
    try {
      const { offlineQueue } = await import('../lib/offline-queue');
      set({ pendingSyncCount: await offlineQueue.size() });
    } catch {
      // noop
    }
  },
  drainOfflineQueue: async () => {
    try {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.drain();
      set({ pendingSyncCount: await offlineQueue.size() });
    } catch {
      // noop
    }
  },

  refreshAssignmentsAPI: async () => {
    try {
      const { bookingsService, mapBooking } = await import('../services');
      const list = await bookingsService.listWorker();
      const services = get().services;
      const titleFor = (sid: string | null) => services.find((s) => s.id === sid)?.name || 'Home Nursing Visit';
      const mapped = list.map((b: any) => mapBooking(b, titleFor));
      if (mapped.length > 0) {
        set({ assignments: mapped });
      }
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  refreshNewRequestsAPI: async () => {
    try {
      const { bookingsService, mapBooking } = await import('../services');
      const list = await bookingsService.newRequests();
      const services = get().services;
      const titleFor = (sid: string | null) => services.find((s) => s.id === sid)?.name || 'Home Nursing Visit';
      const mapped = list.map((b: any) => mapBooking(b, titleFor));
      if (mapped.length > 0) {
        set({ newRequests: mapped });
      }
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  acceptAssignmentAPI: async (id) => {
    // Concurrency-safe: do NOT optimistically move to assignments. The backend
    // is the source of truth — only after a confirmed 200 do we update local
    // state. On 409 BOOKING_ALREADY_CLAIMED we still remove the row from
    // newRequests since it's no longer claimable by anyone.
    try {
      const { bookingsService } = await import('../services');
      await bookingsService.accept(id);
      // Backend confirmed claim. Remove from newRequests and refresh
      // assignments so we get the canonical row (with worker_id, accepted_at).
      set({ newRequests: get().newRequests.filter((r) => r.id !== id) });
      await get().refreshAssignmentsAPI();
    } catch (e: any) {
      const code = e?.detail?.code;
      if (code === 'BOOKING_ALREADY_CLAIMED') {
        // Another worker won the race — drop the stale request locally.
        set({
          newRequests: get().newRequests.filter((r) => r.id !== id),
          apiError: 'This booking has already been claimed by another care professional.',
        });
      } else if (code === 'WORKER_TIME_CONFLICT') {
        set({ apiError: 'You already have another booking during this time.' });
      } else if (code === 'BOOKING_NOT_AVAILABLE') {
        set({
          newRequests: get().newRequests.filter((r) => r.id !== id),
          apiError: 'This request is no longer available.',
        });
      } else {
        set({ apiError: e?.message || 'Could not accept assignment' });
      }
      // Re-throw so the UI can re-enable the button / show the right alert.
      throw e;
    }
  },

  cancelAssignmentAPI: async (id, reason) => {
    set({
      assignments: get().assignments.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)),
    });
    try {
      const { bookingsService } = await import('../services');
      await bookingsService.cancel(id, reason);
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  startVisitAPI: async (id, lat, lng) => {
    // Optimistic UI update
    get().startVisit(id);
    try {
      const { visitsService } = await import('../services');
      await visitsService.checkin(id, lat, lng);
    } catch (e: any) {
      // Queue for retry if network-down
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/visits/${id}/checkin`, { latitude: lat, longitude: lng });
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  submitVitalsAPI: async (bookingId, v) => {
    const payload: any = {
      bp_systolic: v.bp_systolic,
      bp_diastolic: v.bp_diastolic,
      pulse: v.pulse,
      spo2: v.spo2,
      temperature_f: v.temperature ? Number(v.temperature) : undefined,
      blood_sugar_random: v.glucose,
    };
    try {
      const { visitsService } = await import('../services');
      await visitsService.submitVitals(bookingId, payload);
    } catch (e: any) {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/visits/${bookingId}/vitals`, {
        ...payload,
        is_offline_submitted: true,
      });
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  logMedicationAPI: async (bookingId, m) => {
    const payload = {
      drug_name: m.medication_name,
      dose_amount: m.dose || '1',
      administered_at: new Date().toISOString(),
      patient_response: (m as any).notes,
      allergy_check_done: true,
      allergy_confirmed_clear: true,
      patient_identified: true,
      expiry_checked: true,
    };
    try {
      const { visitsService } = await import('../services');
      await visitsService.logMedication(bookingId, payload);
    } catch (e: any) {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/visits/${bookingId}/medications`, {
        ...payload,
        is_offline_submitted: true,
      });
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  completeVisitAPI: async (id, careNote, summary) => {
    // 1. Local state — already done by completeVisit (sync). Call it first.
    get().completeVisit(id, careNote);
    // 2. Submit each vital + medication, then checkout
    const v = careNote.vitals || ({} as any);
    const bpParts = (v.bp || '').split('/');

    const systolic = parseInt(bpParts[0] ?? '');
    const diastolic = parseInt(bpParts[1] ?? '');
    const pulseVal = parseInt(v.pulse ?? '');
    const spo2Val = parseInt(v.spo2 ?? '');
    const glucoseVal = parseInt(v.glucose ?? '');

    const vitalsPayload = {
      bp_systolic: !isNaN(systolic) ? systolic : undefined,
      bp_diastolic: !isNaN(diastolic) ? diastolic : undefined,
      pulse: !isNaN(pulseVal) ? pulseVal : undefined,
      temperature: v.temp ? String(v.temp) : undefined,
      spo2: !isNaN(spo2Val) ? spo2Val : undefined,
      glucose: !isNaN(glucoseVal) ? glucoseVal : undefined,
    };
    const careNotesText = careNote.observations || summary || 'Visit completed';
    const familySummary = summary || careNote.observations || careNotesText;
    try {
      // Patch 4 note: vitals + medications submission is still useful for
      // historical analytics and offline-sync, but it is no longer the
      // gatekeeper for checkout. The backend now blocks checkout via the
      // dynamic workflow engine (validate_documentation_completion), so we
      // explicitly do NOT auto-submit a synthetic checklist row here.
      // The clinical screen is responsible for capturing checklist + doc
      // responses through the /care/workflow/* endpoints before this call.
      if (Object.values(vitalsPayload).some((x) => x !== undefined)) {
        await get().submitVitalsAPI(id, vitalsPayload);
      }
      for (const med of careNote.medications || []) {
        if (!med.name) continue;
        await get().logMedicationAPI(id, { medication_name: med.name, dose: med.dose || undefined });
      }
      const { visitsService } = await import('../services');
      await visitsService.checkout(id, {
        latitude: 0,
        longitude: 0,
        family_summary: familySummary,
        care_notes: careNotesText,
      });
    } catch (e: any) {
      // Patch 4: do not silently queue MANDATORY_DOCUMENTATION_INCOMPLETE
      // (422) or CLINICAL_TEMPLATE_MISSING — these are workflow-level
      // validation failures that the UI must surface inline. Re-throw so
      // the clinical screen can render the backend's missing_items list.
      const code = e?.detail?.code;
      if (
        code === 'MANDATORY_DOCUMENTATION_INCOMPLETE' ||
        code === 'CLINICAL_TEMPLATE_MISSING'
      ) {
        set({ apiError: e?.detail?.message || e?.message || 'Checkout blocked' });
        throw e;
      }
      // Network/transient errors → queue for retry as before.
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/visits/${id}/checkout`, {
        latitude: 0,
        longitude: 0,
        family_summary: familySummary,
        care_notes: careNotesText,
      });
      set({
        pendingSyncCount: await offlineQueue.size(),
        apiError: e?.message || 'Checkout queued for retry',
      });
    }
  },

  submitEscalationAPI: async (bookingId, level, notes, symptoms) => {
    // Optimistic local insert
    get().addEscalation({
      id: 'esc-' + Date.now(),
      visitId: bookingId,
      severity: level === 'watch' ? 'watch' : level === 'inform_family' ? 'inform_family' : level === 'contact_doctor' ? 'contact_doctor' : 'emergency',
      symptoms: symptoms || [],
      notes,
      createdAt: new Date().toISOString(),
      notifiedFamily: level !== 'watch',
      notifiedAdmin: true,
      status: 'active',
    });
    const payload = {
      level,
      trigger_type: 'manual',
      notes: notes || (symptoms || []).join(', ') || 'Escalation raised',
      trigger_details: { symptoms: symptoms || [] },
    };
    try {
      const { bookingsService } = await import('../services');
      await bookingsService.escalate(bookingId, payload);
    } catch (e: any) {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/bookings/${bookingId}/escalate`, payload);
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  loadEscalationsAPI: async () => {
    try {
      const { escalationsService } = await import('../services');
      const list = await escalationsService.all();
      const mapped: Escalation[] = list.map((e) => {
        const parties = e.notified_parties || [];
        return {
          id: e.id,
          visitId: e.booking_id,
          severity: e.level as any,
          symptoms: ((e.trigger_details as any)?.symptoms as string[]) || [],
          notes: e.notes || '',
          createdAt: e.created_at,
          notifiedFamily: parties.includes('family'),
          notifiedAdmin: parties.includes('ops') || parties.includes('admin'),
          status: e.status === 'resolved' ? 'resolved' : 'active',
        };
      });
      if (mapped.length > 0) set({ escalations: mapped });
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  loadTrainingAPI: async () => {
    try {
      const { trainingService } = await import('../services');
      const list = await trainingService.list();
      if (list.length > 0) {
        const mapped: TrainingCourse[] = list.map((m: any) => ({
          id: m.id,
          title: m.title,
          category: m.category ?? 'General',
          durationMins: m.duration_minutes ?? 30,  // number, not template string
          description: m.description ?? '',
          modules: 5,
          completed: m.completed ? 5 : 0,
          progress: m.completed ? 100 : 0,
          status: (m.completed ? 'completed' : 'not_started') as 'completed' | 'in_progress' | 'not_started',
          mandatory: m.is_mandatory ?? false,
          thumbnail: m.thumbnail_url ?? 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
        }));
        set({ courses: mapped });
      }
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  loadCertificatesAPI: async () => {
    try {
      const { workerSelfService } = await import('../services');
      await workerSelfService.certificates(); // touch endpoint
    } catch {
      // noop
    }
  },

  loadKitAPI: async () => {
    try {
      const { workerSelfService } = await import('../services');
      const list = await workerSelfService.kit();
      if (list.length > 0) {
        const mapped: KitItem[] = list.map((k: any) => ({
          id: k.id,
          name: k.item_name || k.name,
          category: k.category || 'Essentials',
          required: k.is_required !== undefined ? k.is_required : true,
          checked: k.is_present,
        }));
        set({ kit: mapped });
      }
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  toggleKitAPI: async (kitId: string) => {
    const current = get().kit.find((k) => k.id === kitId);
    if (!current) return;
    const next = !current.checked;
    set({ kit: get().kit.map((k) => (k.id === kitId ? { ...k, checked: next } : k)) });
    try {
      const { workerSelfService } = await import('../services');
      await workerSelfService.toggleKitItem(kitId, next);
    } catch (e: any) {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('PUT', `/workers/me/kit/${kitId}?is_present=${next}`, undefined);
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  submitChecklistAPI: async (bookingId: string, responses: Record<string, any>) => {
    try {
      const { visitsService } = await import('../services');
      await visitsService.submitChecklist(bookingId, responses);
    } catch (e: any) {
      const { offlineQueue } = await import('../lib/offline-queue');
      await offlineQueue.enqueue('POST', `/visits/${bookingId}/checklist`, {
        responses,
        is_offline_submitted: true,
      });
      set({ pendingSyncCount: await offlineQueue.size() });
    }
  },

  loadCareNotesAPI: async (patientId: string) => {
    try {
      const { careNotesService } = await import('../services/visits.service');
      const list = await careNotesService.listForPatient(patientId);
      return list;
    } catch {
      return [];
    }
  },

  loadEarningsAPI: async () => {
    try {
      const { workerSelfService } = await import('../services');
      const e = await workerSelfService.earnings();
      set({ earnings: e });
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  updateAvailabilityAPI: async (status) => {
    try {
      const { workerSelfService } = await import('../services');
      await workerSelfService.updateAvailability(status);
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  bootstrapNurse: async () => {
    await Promise.allSettled([
      get().refreshAssignmentsAPI(),
      get().refreshNewRequestsAPI(),
      get().refreshNotifications(),
      get().loadEscalationsAPI(),
      get().loadTrainingAPI(),
      get().loadKitAPI(),
      get().loadEarningsAPI(),
      get().refreshPendingSync(),
    ]);
  },
  // ===== END Phase 3 slice =====

  assignments: seedNurseAssignments(),
  newRequests: seedNurseRequests(),
  careNotes: {
    a4: {
      bookingId: 'a4',
      vitals: { bp: '128/84', pulse: '78', temp: '98.6', spo2: '97', glucose: '142' },
      medications: [
        { name: 'Insulin Glargine 10 units SC', dose: '10 units', time: '11:35 AM' },
        { name: 'Metformin 500 mg PO', dose: '500 mg', time: '11:40 AM' },
      ],
      observations:
        'Patient comfortable post-injection. No hypoglycemic symptoms. BG monitored 30 min post-dose.',
      followUp: false,
      patientResponse: 'Stable & cooperative',
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    a5: {
      bookingId: 'a5',
      vitals: { bp: '110/70', pulse: '68', temp: '98.2', spo2: '99', glucose: '105' },
      medications: [
        { name: 'Cefuroxime 500 mg PO', dose: '500 mg', time: '04:10 PM' },
        { name: 'Tramadol 50 mg PO PRN', dose: '50 mg', time: '04:30 PM' },
      ],
      observations:
        'Surgical site clean & dry, sutures intact. Pain managed (VAS 2/10). Patient ambulatory with assistance.',
      followUp: true,
      patientResponse: 'Stable & cooperative',
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  acceptRequest: (id) => {
    const req = get().newRequests.find((r) => r.id === id);
    if (!req) return;
    set({
      newRequests: get().newRequests.filter((r) => r.id !== id),
      assignments: [{ ...req, status: 'scheduled' }, ...get().assignments],
    });
  },
  declineRequest: (id) =>
    set({ newRequests: get().newRequests.filter((r) => r.id !== id) }),
  startVisit: (id) =>
    set({
      assignments: get().assignments.map((a) =>
        a.id === id ? { ...a, status: 'active' } : a
      ),
    }),
  completeVisit: (id, careNote) =>
    set({
      assignments: get().assignments.map((a) =>
        a.id === id ? { ...a, status: 'completed' } : a
      ),
      bookings: get().bookings.map((b) =>
        b.id === id ? { ...b, status: 'completed' } : b
      ),
      careNotes: { ...get().careNotes, [id]: careNote },
    }),

  notifications: NOTIFICATIONS,
  markNotificationRead: (id) => {
    // Optimistic update
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    });
    // Fire-and-forget backend sync (silent on failure since UI already updated)
    import('../services').then(({ notificationsService }) => {
      notificationsService.markRead(id).catch(() => { });
    });
  },
  markAllRead: () => {
    set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
    import('../services').then(({ notificationsService }) => {
      notificationsService.markAllRead().catch(() => { });
    });
  },

  kit: KIT_ITEMS,
  toggleKit: (id) =>
    set({
      kit: get().kit.map((k) =>
        k.id === id ? { ...k, checked: !k.checked } : k
      ),
    }),

  isOffline: false,
  pendingSync: 0,
  setOffline: (v) => set({ isOffline: v, pendingSync: v ? 2 : 0 }),
  triggerSync: () => set({ pendingSync: 0, isOffline: false }),

  abhaRecords: ABHA_RECORDS,
  addAbhaRecord: (r) => set({ abhaRecords: [r, ...get().abhaRecords] }),

  tickets: SUPPORT_TICKETS,
  addTicket: (t) => set({ tickets: [t, ...get().tickets] }),
  appendTicketUpdate: (id, msg) =>
    set({
      tickets: get().tickets.map((tk) =>
        tk.id === id
          ? { ...tk, updates: [...tk.updates, { time: 'just now', message: msg, from: 'you' }] }
          : tk
      ),
    }),

  escalations: [],
  addEscalation: (e) => set({ escalations: [e, ...get().escalations] }),
  resolveEscalation: (id) =>
    set({
      escalations: get().escalations.map((e) =>
        e.id === id ? { ...e, status: 'resolved' } : e
      ),
    }),

  courses: TRAINING_COURSES,
  advanceCourse: (id) =>
    set({
      courses: get().courses.map((c) =>
        c.id === id
          ? {
            ...c,
            completed: Math.min(c.modules, c.completed + 1),
            status: c.completed + 1 >= c.modules ? 'completed' : 'in_progress',
          }
          : c
      ),
    }),

  updateUser: (patch) => set({ user: get().user ? { ...(get().user as User), ...patch } : null }),

  availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false },
  toggleAvailability: (day) =>
    set({ availability: { ...get().availability, [day]: !get().availability[day] } }),

  // ===== Phase 4: Realtime + Payments + Assessment =====
  realtimeConnected: false,
  paymentHistory: [],

  connectRealtime: () => {
    if (get().realtimeConnected) return;
    import('../lib/realtime').then(({ realtime }) => {
      realtime.setHandler((evt: any) => get().handleRealtimeEvent(evt));
      realtime.connectUser();
      set({ realtimeConnected: true });
    });
  },
  disconnectRealtime: () => {
    import('../lib/realtime').then(({ realtime }) => {
      realtime.disconnectAllBookings();
      realtime.disconnectUser();
      set({ realtimeConnected: false });
    });
  },
  handleRealtimeEvent: (evt: any) => {
    if (!evt || !evt.type) return;
    switch (evt.type) {
      case 'notification.new': {
        // Server may send the full NotificationOut shape — prepend.
        const n = evt.notification || evt.data || evt;
        const item: NotificationItem = {
          id: n.id || 'rt-' + Date.now(),
          title: n.title || 'Notification',
          body: n.body || n.message || '',
          time: 'just now',
          type: (n.notification_type || n.type || 'general') as any,
          group: (n.group || 'general') as any,    // ← ADD THIS
          read: false,
        };
        set({ notifications: [item, ...get().notifications.filter((x) => x.id !== item.id)] });
        break;
      }
      case 'booking.status_change':
      case 'booking.accepted':
      case 'booking.cancelled': {
        const bid = evt.booking_id || evt.id;
        const status = (evt.status || '').toLowerCase();
        if (!bid || !status) return;
        // Update consumer-side bookings + nurse-side assignments
        const map = (b: Booking) => (b.id === bid ? { ...b, status: status as any } : b);
        set({ bookings: get().bookings.map(map), assignments: get().assignments.map(map) });
        // Refresh in background to get full row
        get().refreshAssignmentsAPI?.().catch(() => { });
        get().refreshBookings?.().catch(() => { });
        break;
      }
      case 'escalation.created':
      case 'escalation.updated': {
        // Pull a fresh list to keep timeline consistent
        get().loadEscalationsAPI?.().catch(() => { });
        break;
      }
      case 'location.update': {
        // Pass-through — UI subscribes to per-booking topic directly via realtime.connectBooking
        break;
      }
      case 'visit.completed': {
        get().refreshAssignmentsAPI?.().catch(() => { });
        break;
      }
      default:
        break;
    }
  },

  initiatePaymentAPI: async (bookingId: string) => {
    const { paymentsService } = await import('../services');
    return await paymentsService.createOrder(bookingId);
  },
  verifyPaymentAPI: async (payload) => {
    const { paymentsService } = await import('../services');
    const r = await paymentsService.verify(payload);
    // Optimistic: update local booking row to confirmed/paid
    set({
      bookings: get().bookings.map((b) =>
        b.id === payload.booking_id ? { ...b, status: 'scheduled', paid: true } : b,
      ),
    });
    return { verified: !!r?.verified };
  },
  loadPaymentHistoryAPI: async () => {
    try {
      const { paymentsService } = await import('../services');
      const h = await paymentsService.history();
      set({ paymentHistory: h });
    } catch (e: any) {
      set({ apiError: e?.message || null });
    }
  },

  submitAssessmentAPI: async (moduleId: string, answers: number[]) => {
    const { trainingService } = await import('../services');
    const r = await trainingService.submitAssessment(moduleId, answers);
    if (r.passed) {
      set({
        courses: get().courses.map((c) =>
          c.id === moduleId
            ? { ...c, status: 'completed', progress: 100, completed: c.modules }
            : c,
        ),
      });
    }
    return r;
  },
  // ===== END Phase 4 slice =====
}));
