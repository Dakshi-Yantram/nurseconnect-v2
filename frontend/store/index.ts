/**
 * Global app store.
 *
 * Every collection here starts EMPTY and is only ever replaced by what the
 * backend returns. There is deliberately no seeded demo data and no
 * "keep the old list if the response was empty" fallback: those made a brand
 * new consumer see three fake bookings and a nurse with no work see five fake
 * assignments, which is indistinguishable from a broken API. An empty list is
 * a real answer — screens render their empty state for it.
 */
import { create } from 'zustand';
import {
  Booking,
  NotificationItem,
  KitItem,
  Role,
  User,
  VisitStatus,
  CareNote,
  Escalation,
  TrainingCourse,
  Nurse,
} from '../types';
import { toAppRole, isWebOnlyRole } from '../lib/roles';
import type { BackendUser } from '../services/auth.service';

/** Loading/error state for one remote collection. */
export interface LoadState {
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const idle = (): LoadState => ({ loading: false, loaded: false, error: null });

type Collection =
  | 'services'
  | 'packages'
  | 'nurses'
  | 'bookings'
  | 'assignments'
  | 'newRequests'
  | 'notifications'
  | 'patients'
  | 'familyMembers'
  | 'addresses'
  | 'escalations'
  | 'courses'
  | 'assessments'
  | 'kit'
  | 'earnings'
  | 'eligibility'
  | 'payments'
  | 'tickets';

interface AppState {
  // ---- auth ----
  user: User | null;
  role: Role | null;
  /**
   * Set when someone signs in with an admin/reviewer/operations/support
   * account. Those portals are web-only, so the UI shows an explanation
   * instead of dropping them into an empty shell.
   */
  webOnlyRole: string | null;
  authBootstrapping: boolean;
  setRole: (role: Role) => void;
  setUserFromBackend: (u: BackendUser) => void;
  bootstrapSession: () => Promise<void>;
  hydrateForRole: (role: Role) => Promise<void>;
  logout: () => Promise<void>;

  // ---- per-collection load state ----
  loadState: Record<Collection, LoadState>;
  apiError: string | null;
  setApiError: (msg: string | null) => void;

  // ---- catalogue ----
  services: import('../services/mappers').BackendService[];
  packages: import('../services/catalog.service').CarePackageOut[];
  loadServices: () => Promise<void>;
  loadPackages: () => Promise<void>;

  // ---- consumer ----
  nurses: Nurse[];
  bookings: Booking[];
  patients: import('../services/users.service').PatientOut[];
  familyMembers: import('../services/users.service').FamilyMemberOut[];
  addresses: import('../services/addresses.service').ConsumerAddress[];
  paymentHistory: import('../services/payments.service').PaymentHistoryItem[];
  draftBooking: Partial<Booking> | null;

  setDraftBooking: (b: Partial<Booking> | null) => void;
  searchNurses: (params?: import('../services/workers.service').WorkerSearchParams) => Promise<void>;
  refreshBookings: () => Promise<void>;
  loadPatients: () => Promise<void>;
  loadFamilyMembers: () => Promise<void>;
  loadAddresses: () => Promise<void>;
  loadPaymentHistoryAPI: () => Promise<void>;
  createBookingAPI: (
    payload: import('../services/bookings.service').BookingCreatePayload,
  ) => Promise<Booking>;
  cancelBookingAPI: (id: string, reason: string) => Promise<void>;
  refundBookingAPI: (id: string, amount: number, reason: string) => Promise<void>;
  bootstrapFamily: () => Promise<void>;

  // ---- payments ----
  initiatePaymentAPI: (
    bookingId: string,
  ) => Promise<import('../services/payments.service').BackendPaymentOrder>;
  verifyPaymentAPI: (
    payload: import('../services/payments.service').PaymentVerifyPayload,
  ) => Promise<{ verified: boolean }>;

  // ---- nurse ----
  assignments: Booking[];
  newRequests: Booking[];
  kit: KitItem[];
  earnings: import('../services/worker-self.service').EarningsOut | null;
  eligibility: import('../services/worker-self.service').ServiceEligibilityItem[];
  workerProfile: import('../services/worker-self.service').WorkerMeOut | null;
  onboarding: import('../services/worker-self.service').OnboardingSnapshot | null;
  careNotes: Record<string, CareNote>;

  refreshAssignmentsAPI: () => Promise<void>;
  refreshNewRequestsAPI: () => Promise<void>;
  acceptAssignmentAPI: (id: string) => Promise<void>;
  cancelAssignmentAPI: (id: string, reason: string) => Promise<void>;
  startVisitAPI: (id: string, lat: number, lng: number) => Promise<void>;
  startVisitWithOtpAPI: (id: string, otp: string, lat: number, lng: number) => Promise<void>;
  submitVitalsAPI: (
    bookingId: string,
    v: {
      bp_systolic?: number;
      bp_diastolic?: number;
      pulse?: number;
      temperature?: string;
      spo2?: number;
      glucose?: number;
    },
  ) => Promise<void>;
  logMedicationAPI: (
    bookingId: string,
    m: { medication_name: string; dose?: string; notes?: string },
  ) => Promise<void>;
  completeVisitAPI: (id: string, careNote: CareNote, summary?: string) => Promise<void>;
  submitChecklistAPI: (bookingId: string, responses: Record<string, any>) => Promise<void>;
  loadCareNotesAPI: (patientId: string) => Promise<any[]>;
  loadKitAPI: () => Promise<void>;
  toggleKitAPI: (kitId: string) => Promise<void>;
  loadEarningsAPI: () => Promise<void>;
  loadEligibilityAPI: () => Promise<void>;
  setServicePreferenceAPI: (
    target: { target_type: 'service' | 'package'; target_id: string },
    status: import('../services/worker-self.service').PreferenceStatus,
  ) => Promise<void>;
  loadWorkerProfileAPI: () => Promise<void>;
  loadOnboardingAPI: () => Promise<void>;
  updateAvailabilityAPI: (status: 'online' | 'offline' | 'busy' | 'on_leave') => Promise<void>;
  bootstrapNurse: () => Promise<void>;

  // ---- escalations ----
  escalations: Escalation[];
  submitEscalationAPI: (
    bookingId: string,
    level: 'watch' | 'inform_family' | 'contact_doctor' | 'emergency',
    notes: string,
    symptoms?: string[],
  ) => Promise<void>;
  loadEscalationsAPI: () => Promise<void>;

  // ---- training ----
  courses: TrainingCourse[];
  assessments: import('../services/training.service').AssessmentOut[];
  loadTrainingAPI: () => Promise<void>;
  loadAssessmentsAPI: () => Promise<void>;

  // ---- notifications ----
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;

  // ---- realtime ----
  realtimeConnected: boolean;
  connectRealtime: () => void;
  disconnectRealtime: () => void;
  handleRealtimeEvent: (event: any) => void;

  // ---- offline ----
  isOffline: boolean;
  pendingSyncCount: number;
  setOffline: (v: boolean) => void;
  refreshPendingSync: () => Promise<void>;
  drainOfflineQueue: () => Promise<void>;

  // ---- local helpers ----
  updateUser: (patch: Partial<User>) => void;
  updateBookingStatus: (id: string, status: VisitStatus) => void;
}

const INITIAL_LOAD_STATE: Record<Collection, LoadState> = {
  services: idle(),
  packages: idle(),
  nurses: idle(),
  bookings: idle(),
  assignments: idle(),
  newRequests: idle(),
  notifications: idle(),
  patients: idle(),
  familyMembers: idle(),
  addresses: idle(),
  escalations: idle(),
  courses: idle(),
  assessments: idle(),
  kit: idle(),
  earnings: idle(),
  eligibility: idle(),
  payments: idle(),
  tickets: idle(),
};

export const useStore = create<AppState>((set, get) => {
  /** Wrap a loader so its collection's loading/loaded/error state is tracked. */
  const track = async (key: Collection, fn: () => Promise<void>) => {
    set((s) => ({
      loadState: { ...s.loadState, [key]: { ...s.loadState[key], loading: true, error: null } },
    }));
    try {
      await fn();
      set((s) => ({
        loadState: { ...s.loadState, [key]: { loading: false, loaded: true, error: null } },
      }));
    } catch (e: any) {
      const message = e?.message || 'Something went wrong';
      set((s) => ({
        loadState: { ...s.loadState, [key]: { loading: false, loaded: true, error: message } },
        apiError: message,
      }));
    }
  };

  /** Resolve a booking's display title from the loaded catalogue. */
  const titleResolver = () => (serviceId: string | null, packageId: string | null) => {
    const pkg = get().packages.find((p) => p.id === packageId);
    if (pkg) return pkg.name;
    const svc = get().services.find((s) => s.id === serviceId);
    if (svc) return svc.name;
    return 'Home nursing visit';
  };

  return {
    // ---------------------------------------------------------------- auth
    user: null,
    role: null,
    webOnlyRole: null,
    authBootstrapping: true,
    loadState: INITIAL_LOAD_STATE,
    apiError: null,
    setApiError: (msg) => set({ apiError: msg }),
    setRole: (role) => set({ role }),

    setUserFromBackend: (u) => {
      if (isWebOnlyRole(u.role)) {
        set({ webOnlyRole: u.role, role: null, user: null });
        return;
      }
      const appRole = toAppRole(u.role);
      if (!appRole) {
        set({ webOnlyRole: u.role, role: null, user: null });
        return;
      }
      set({
        webOnlyRole: null,
        role: appRole,
        user: {
          id: u.id,
          // No invented placeholder name — an empty name is a real state the
          // profile screen prompts the user to fill in.
          name: u.full_name || '',
          phone: u.phone_e164,
          email: u.email || '',
          role: appRole,
          status: u.status,
          abhaId: '',
          avatar: u.avatar_url || undefined,
        },
      });
    },

    bootstrapSession: async () => {
      try {
        const { authService } = await import('../services/auth.service');
        const u = await authService.restoreSession();
        if (u) {
          get().setUserFromBackend(u);
          const role = get().role;
          if (role) {
            get().hydrateForRole(role).catch(() => {});
            get().connectRealtime();
            get().drainOfflineQueue().catch(() => {});
            // Register push tokens so this device can be rung while
            // backgrounded. No-ops in Expo Go and on builds without the
            // native calling modules.
            import('../lib/call-push').then(({ registerForCallPush }) => {
              registerForCallPush().catch(() => {});
            });
          }
        }
      } catch {
        // Stay logged out; the router sends the user to role-select.
      } finally {
        set({ authBootstrapping: false });
      }
    },

    hydrateForRole: async (role) => {
      if (role === 'family') return get().bootstrapFamily();
      if (role === 'nurse') return get().bootstrapNurse();
      // Trainer / clinical lead screens fetch their own data on mount —
      // there's no shared dashboard payload worth prefetching.
    },

    logout: async () => {
      // Drop push tokens BEFORE clearing the session — the call needs a valid
      // token, and leaving them registered would ring this handset for an
      // account that is no longer signed in on it.
      try {
        const { unregisterFromCallPush } = await import('../lib/call-push');
        await unregisterFromCallPush();
      } catch {
        // Never block sign-out on push cleanup.
      }
      try {
        const { authService } = await import('../services/auth.service');
        await authService.logout();
      } catch {
        // Ignore — local state is cleared regardless.
      }
      get().disconnectRealtime();
      // Full reset so the next account never sees the previous one's data.
      set({
        user: null,
        role: null,
        webOnlyRole: null,
        loadState: INITIAL_LOAD_STATE,
        apiError: null,
        services: [],
        packages: [],
        nurses: [],
        bookings: [],
        patients: [],
        familyMembers: [],
        addresses: [],
        paymentHistory: [],
        draftBooking: null,
        assignments: [],
        newRequests: [],
        kit: [],
        earnings: null,
        eligibility: [],
        workerProfile: null,
        onboarding: null,
        careNotes: {},
        escalations: [],
        courses: [],
        assessments: [],
        notifications: [],
      });
    },

    // ----------------------------------------------------------- catalogue
    services: [],
    packages: [],

    loadServices: () =>
      track('services', async () => {
        const { catalogService } = await import('../services');
        set({ services: await catalogService.listServices() });
      }),

    loadPackages: () =>
      track('packages', async () => {
        const { catalogService } = await import('../services');
        set({ packages: await catalogService.listPackages() });
      }),

    // ------------------------------------------------------------ consumer
    nurses: [],
    bookings: [],
    patients: [],
    familyMembers: [],
    addresses: [],
    paymentHistory: [],
    draftBooking: null,

    setDraftBooking: (b) => set({ draftBooking: b }),

    searchNurses: (params) =>
      track('nurses', async () => {
        const { workersService, mapWorker } = await import('../services');
        const list = await workersService.search(params || {});
        set({ nurses: list.map(mapWorker) });
      }),

    refreshBookings: () =>
      track('bookings', async () => {
        const { bookingsService, mapBooking } = await import('../services');
        const list = await bookingsService.listConsumer();
        set({ bookings: list.map((b) => mapBooking(b, titleResolver())) });
      }),

    loadPatients: () =>
      track('patients', async () => {
        const { usersService } = await import('../services');
        set({ patients: await usersService.listPatients() });
      }),

    loadFamilyMembers: () =>
      track('familyMembers', async () => {
        const { usersService } = await import('../services');
        set({ familyMembers: await usersService.listFamilyMembers() });
      }),

    loadAddresses: () =>
      track('addresses', async () => {
        const { addressesService } = await import('../services');
        set({ addresses: await addressesService.list() });
      }),

    loadPaymentHistoryAPI: () =>
      track('payments', async () => {
        const { paymentsService } = await import('../services');
        set({ paymentHistory: await paymentsService.history() });
      }),

    createBookingAPI: async (payload) => {
      const { bookingsService, mapBooking } = await import('../services');
      const created = await bookingsService.create(payload);
      const mapped = mapBooking(created, titleResolver());
      set({ bookings: [mapped, ...get().bookings.filter((b) => b.id !== mapped.id)] });
      return mapped;
    },

    cancelBookingAPI: async (id, reason) => {
      const { bookingsService, mapBooking } = await import('../services');
      const updated = await bookingsService.cancel(id, reason);
      const mapped = mapBooking(updated, titleResolver());
      set({ bookings: get().bookings.map((b) => (b.id === id ? mapped : b)) });
    },

    refundBookingAPI: async (id, amount, reason) => {
      const { paymentsService } = await import('../services');
      await paymentsService.refund(id, amount, reason);
      // The refund endpoint also cancels the booking, so re-read rather than
      // patching the row by hand.
      await get().refreshBookings();
      await get().loadPaymentHistoryAPI();
    },

    bootstrapFamily: async () => {
      await Promise.allSettled([
        get().loadServices(),
        get().loadPackages(),
        get().loadPatients(),
        get().loadAddresses(),
      ]);
      // Bookings resolve their titles from the catalogue, so load it first.
      await Promise.allSettled([
        get().refreshBookings(),
        get().refreshNotifications(),
        get().loadFamilyMembers(),
      ]);
    },

    // ------------------------------------------------------------ payments
    initiatePaymentAPI: async (bookingId) => {
      const { paymentsService } = await import('../services');
      return paymentsService.createOrder(bookingId);
    },

    verifyPaymentAPI: async (payload) => {
      const { paymentsService } = await import('../services');
      const r = await paymentsService.verify(payload);
      // Re-read instead of guessing the new status: verification moves the
      // booking to `confirmed` and starts the dispatch clock server-side.
      await get().refreshBookings();
      return { verified: !!r?.verified };
    },

    // --------------------------------------------------------------- nurse
    assignments: [],
    newRequests: [],
    kit: [],
    earnings: null,
    eligibility: [],
    workerProfile: null,
    onboarding: null,
    careNotes: {},

    refreshAssignmentsAPI: () =>
      track('assignments', async () => {
        const { bookingsService, mapBooking } = await import('../services');
        const list = await bookingsService.listWorker();
        set({ assignments: list.map((b) => mapBooking(b, titleResolver())) });
      }),

    refreshNewRequestsAPI: () =>
      track('newRequests', async () => {
        const { bookingsService, mapBooking } = await import('../services');
        const list = await bookingsService.newRequests();
        set({ newRequests: list.map((b) => mapBooking(b, titleResolver())) });
      }),

    acceptAssignmentAPI: async (id) => {
      // Concurrency-safe: never optimistically move the row. The backend
      // decides who wins the race; only a confirmed 200 updates local state.
      try {
        const { bookingsService } = await import('../services');
        await bookingsService.accept(id);
        set({ newRequests: get().newRequests.filter((r) => r.id !== id) });
        await get().refreshAssignmentsAPI();
      } catch (e: any) {
        const code = e?.detail?.code;
        if (code === 'BOOKING_ALREADY_CLAIMED') {
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
        throw e;
      }
    },

    cancelAssignmentAPI: async (id, reason) => {
      // A nurse cancelling does NOT end the booking — the server moves it to
      // `rematch_pending` and re-offers it. Re-read so the row reflects that
      // rather than showing a cancellation that didn't happen.
      const { bookingsService } = await import('../services');
      await bookingsService.cancel(id, reason);
      await get().refreshAssignmentsAPI();
    },

    startVisitAPI: async (id, lat, lng) => {
      const { visitsService } = await import('../services');
      try {
        await visitsService.checkin(id, lat, lng);
        await get().refreshAssignmentsAPI();
      } catch (e: any) {
        if (e?.network) {
          const { offlineQueue } = await import('../lib/offline-queue');
          await offlineQueue.enqueue('POST', `/visits/${id}/checkin`, {
            latitude: lat,
            longitude: lng,
          });
          set({ pendingSyncCount: await offlineQueue.size() });
          return;
        }
        throw e;
      }
    },

    startVisitWithOtpAPI: async (id, otp, lat, lng) => {
      // Deliberately never queued offline: the code is verified against Redis
      // with a 5-attempt cap, so it has to be checked live.
      const { visitsService } = await import('../services');
      await visitsService.verifyStartOtp(id, otp, lat, lng);
      await get().refreshAssignmentsAPI();
    },

    submitVitalsAPI: async (bookingId, v) => {
      const payload = {
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
        if (!e?.network) throw e;
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
        patient_response: m.notes,
        allergy_check_done: true,
        allergy_confirmed_clear: true,
        patient_identified: true,
        expiry_checked: true,
      };
      try {
        const { visitsService } = await import('../services');
        await visitsService.logMedication(bookingId, payload);
      } catch (e: any) {
        if (!e?.network) throw e;
        const { offlineQueue } = await import('../lib/offline-queue');
        await offlineQueue.enqueue('POST', `/visits/${bookingId}/medications`, {
          ...payload,
          is_offline_submitted: true,
        });
        set({ pendingSyncCount: await offlineQueue.size() });
      }
    },

    completeVisitAPI: async (id, careNote, summary) => {
      const v = careNote.vitals || {};
      const [sysRaw, diaRaw] = (v.bp || '').split('/');
      const num = (x?: string) => {
        const n = parseInt(x ?? '', 10);
        return isNaN(n) ? undefined : n;
      };

      const vitalsPayload = {
        bp_systolic: num(sysRaw),
        bp_diastolic: num(diaRaw),
        pulse: num(v.pulse),
        temperature: v.temp ? String(v.temp) : undefined,
        spo2: num(v.spo2),
        glucose: num(v.glucose),
      };
      const careNotesText = careNote.observations || summary || 'Visit completed';
      const familySummary = summary || careNote.observations || careNotesText;

      // Vitals and medications are recorded for the clinical record, but they
      // are not what gates checkout — the workflow engine does that via
      // validate_documentation_completion. The clinical screen is responsible
      // for the checklist/documentation submissions before we get here.
      if (Object.values(vitalsPayload).some((x) => x !== undefined)) {
        await get().submitVitalsAPI(id, vitalsPayload);
      }
      for (const med of careNote.medications || []) {
        if (!med.name) continue;
        await get().logMedicationAPI(id, {
          medication_name: med.name,
          dose: med.dose || undefined,
        });
      }

      const { visitsService } = await import('../services');
      const checkoutBody = {
        latitude: 0,
        longitude: 0,
        family_summary: familySummary,
        care_notes: careNotesText,
      };
      try {
        await visitsService.checkout(id, checkoutBody);
        set({ careNotes: { ...get().careNotes, [id]: careNote } });
        await get().refreshAssignmentsAPI();
      } catch (e: any) {
        // Workflow validation failures must surface inline so the clinical
        // screen can render the backend's `missing_items` — never queued.
        const code = e?.detail?.code;
        if (
          !e?.network ||
          code === 'MANDATORY_DOCUMENTATION_INCOMPLETE' ||
          code === 'CLINICAL_TEMPLATE_MISSING'
        ) {
          set({ apiError: e?.detail?.message || e?.message || 'Checkout blocked' });
          throw e;
        }
        const { offlineQueue } = await import('../lib/offline-queue');
        await offlineQueue.enqueue('POST', `/visits/${id}/checkout`, checkoutBody);
        set({
          pendingSyncCount: await offlineQueue.size(),
          careNotes: { ...get().careNotes, [id]: careNote },
          apiError: 'Offline — checkout queued and will sync automatically.',
        });
      }
    },

    submitChecklistAPI: async (bookingId, responses) => {
      try {
        const { visitsService } = await import('../services');
        await visitsService.submitChecklist(bookingId, responses);
      } catch (e: any) {
        if (!e?.network) throw e;
        const { offlineQueue } = await import('../lib/offline-queue');
        await offlineQueue.enqueue('POST', `/visits/${bookingId}/checklist`, {
          responses,
          is_offline_submitted: true,
        });
        set({ pendingSyncCount: await offlineQueue.size() });
      }
    },

    loadCareNotesAPI: async (patientId) => {
      const { careNotesService } = await import('../services');
      return careNotesService.listForPatient(patientId);
    },

    loadKitAPI: () =>
      track('kit', async () => {
        const { workerSelfService } = await import('../services');
        const list = await workerSelfService.kit();
        set({
          kit: list.map((k) => ({
            id: k.id,
            name: k.item_name,
            category: 'Essentials',
            required: true,
            checked: k.is_present,
          })),
        });
      }),

    toggleKitAPI: async (kitId) => {
      const current = get().kit.find((k) => k.id === kitId);
      if (!current) return;
      const next = !current.checked;
      set({ kit: get().kit.map((k) => (k.id === kitId ? { ...k, checked: next } : k)) });
      try {
        const { workerSelfService } = await import('../services');
        await workerSelfService.toggleKitItem(kitId, next);
      } catch (e: any) {
        if (e?.network) {
          const { offlineQueue } = await import('../lib/offline-queue');
          await offlineQueue.enqueue(
            'PUT',
            `/workers/me/kit/${kitId}?is_present=${next}`,
            undefined,
          );
          set({ pendingSyncCount: await offlineQueue.size() });
          return;
        }
        // Roll the toggle back so the checkbox matches the server.
        set({
          kit: get().kit.map((k) => (k.id === kitId ? { ...k, checked: current.checked } : k)),
          apiError: e?.message || 'Could not update kit item',
        });
      }
    },

    loadEarningsAPI: () =>
      track('earnings', async () => {
        const { workerSelfService } = await import('../services');
        set({ earnings: await workerSelfService.earnings() });
      }),

    loadEligibilityAPI: () =>
      track('eligibility', async () => {
        const { workerSelfService } = await import('../services');
        set({ eligibility: await workerSelfService.serviceEligibility() });
      }),

    setServicePreferenceAPI: async (target, status) => {
      const { workerSelfService } = await import('../services');
      const updated = await workerSelfService.updateServicePreference({
        target_type: target.target_type,
        target_id: target.target_id,
        preference_status: status,
      });
      set({
        eligibility: get().eligibility.map((e) =>
          e.id === updated.id && e.target_type === updated.target_type ? updated : e,
        ),
      });
      // Opting in changes which bookings this nurse can see.
      get().refreshNewRequestsAPI().catch(() => {});
    },

    loadWorkerProfileAPI: async () => {
      const { workerSelfService } = await import('../services');
      set({ workerProfile: await workerSelfService.me() });
    },

    loadOnboardingAPI: async () => {
      const { workerSelfService } = await import('../services');
      set({ onboarding: await workerSelfService.onboarding() });
    },

    updateAvailabilityAPI: async (status) => {
      const { workerSelfService } = await import('../services');
      const updated = await workerSelfService.updateAvailability(status);
      set({ workerProfile: updated });
    },

    bootstrapNurse: async () => {
      await Promise.allSettled([get().loadServices(), get().loadPackages()]);
      await Promise.allSettled([
        get().refreshAssignmentsAPI(),
        get().refreshNewRequestsAPI(),
        get().refreshNotifications(),
        get().loadEscalationsAPI(),
        get().loadKitAPI(),
        get().loadEarningsAPI(),
        get().loadWorkerProfileAPI().catch(() => {}),
        get().loadOnboardingAPI().catch(() => {}),
        get().refreshPendingSync(),
      ]);
    },

    // -------------------------------------------------------- escalations
    escalations: [],

    submitEscalationAPI: async (bookingId, level, notes, symptoms) => {
      const payload = {
        level,
        trigger_type: 'manual',
        notes: notes || (symptoms || []).join(', ') || 'Escalation raised',
        trigger_details: { symptoms: symptoms || [] },
      };
      try {
        const { bookingsService } = await import('../services');
        await bookingsService.escalate(bookingId, payload);
        await get().loadEscalationsAPI();
      } catch (e: any) {
        if (!e?.network) throw e;
        const { offlineQueue } = await import('../lib/offline-queue');
        await offlineQueue.enqueue('POST', `/bookings/${bookingId}/escalate`, payload);
        set({ pendingSyncCount: await offlineQueue.size() });
      }
    },

    loadEscalationsAPI: () =>
      track('escalations', async () => {
        const { escalationsService } = await import('../services');
        const list = await escalationsService.all();
        set({
          escalations: list.map((e) => {
            const parties = e.notified_parties || [];
            return {
              id: e.id,
              visitId: e.booking_id,
              severity: e.level as Escalation['severity'],
              symptoms: ((e.trigger_details as any)?.symptoms as string[]) || [],
              notes: e.notes || '',
              createdAt: e.created_at,
              notifiedFamily: parties.includes('family'),
              notifiedAdmin: parties.includes('ops') || parties.includes('admin'),
              status: e.status === 'resolved' ? 'resolved' : 'active',
            };
          }),
        });
      }),

    // ------------------------------------------------------------ training
    courses: [],
    assessments: [],

    loadTrainingAPI: () =>
      track('courses', async () => {
        const { trainingService } = await import('../services');
        const list = await trainingService.list();
        set({
          courses: list.map((m) => ({
            id: m.id,
            title: m.title,
            category: m.category ?? 'General',
            durationMins: m.duration_minutes ?? 0,
            modules: 1,
            completed: m.completed ? 1 : 0,
            status: m.completed ? 'completed' : 'not_started',
            thumbnail: m.video_url ?? '',
          })),
        });
      }),

    loadAssessmentsAPI: () =>
      track('assessments', async () => {
        const { trainingService } = await import('../services');
        set({ assessments: await trainingService.listAssessments() });
      }),

    // ------------------------------------------------------- notifications
    notifications: [],

    refreshNotifications: () =>
      track('notifications', async () => {
        const { notificationsService, mapNotification } = await import('../services');
        const list = await notificationsService.list();
        set({ notifications: list.map(mapNotification) });
      }),

    markNotificationRead: (id) => {
      set({
        notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      });
      import('../services').then(({ notificationsService }) => {
        notificationsService.markRead(id).catch(() => {});
      });
    },

    markAllRead: () => {
      set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
      import('../services').then(({ notificationsService }) => {
        notificationsService.markAllRead().catch(() => {});
      });
    },

    // ------------------------------------------------------------ realtime
    realtimeConnected: false,

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

    handleRealtimeEvent: (evt) => {
      if (!evt || !evt.type) return;
      switch (evt.type) {
        case 'notification.new': {
          // Rather than trusting the socket payload's shape, re-read the list
          // so the badge count and the screen can never drift apart.
          get().refreshNotifications().catch(() => {});
          break;
        }
        case 'booking.status_change':
        case 'booking.accepted':
        case 'booking.cancelled':
        case 'visit.completed': {
          const role = get().role;
          if (role === 'nurse') {
            get().refreshAssignmentsAPI().catch(() => {});
            get().refreshNewRequestsAPI().catch(() => {});
          } else if (role === 'family') {
            get().refreshBookings().catch(() => {});
          }
          break;
        }
        case 'incoming_call': {
          // App is open, so the WebSocket beats the push. Ring immediately —
          // the push path is the fallback for when this socket isn't alive.
          import('../lib/call-manager').then(({ callManager }) => {
            callManager.reportIncomingCall(evt);
          });
          break;
        }
        case 'call_ended': {
          import('../lib/call-manager').then(({ callManager }) => {
            // Only tear down if this is the call we're actually on — a stale
            // event for a previous call must not kill a live one.
            if (callManager.getState().callSessionId === evt.call_session_id) {
              callManager.hangUp('completed');
            }
          });
          break;
        }
        case 'escalation.created':
        case 'escalation.updated': {
          get().loadEscalationsAPI().catch(() => {});
          break;
        }
        default:
          break;
      }
    },

    // ------------------------------------------------------------- offline
    isOffline: false,
    pendingSyncCount: 0,
    setOffline: (v) => set({ isOffline: v }),

    refreshPendingSync: async () => {
      try {
        const { offlineQueue } = await import('../lib/offline-queue');
        set({ pendingSyncCount: await offlineQueue.size() });
      } catch {
        // Queue unavailable — leave the counter as-is.
      }
    },

    drainOfflineQueue: async () => {
      try {
        const { offlineQueue } = await import('../lib/offline-queue');
        await offlineQueue.drain();
        set({ pendingSyncCount: await offlineQueue.size() });
      } catch {
        // Retried on the next app foreground.
      }
    },

    // ------------------------------------------------------- local helpers
    updateUser: (patch) => set({ user: get().user ? { ...(get().user as User), ...patch } : null }),

    updateBookingStatus: (id, status) =>
      set({
        bookings: get().bookings.map((b) => (b.id === id ? { ...b, status } : b)),
        assignments: get().assignments.map((b) => (b.id === id ? { ...b, status } : b)),
      }),
  };
});
