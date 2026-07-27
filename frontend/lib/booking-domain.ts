/**
 * Booking status semantics, shared by every screen.
 *
 * Mirrors the web frontend so both clients bucket a booking identically. The
 * rule that matters: bucket on `rawStatus` (the backend enum), never on the
 * coarse badge status — otherwise `rematch_pending` and `disputed` fall
 * through every filter and the booking disappears from the UI entirely.
 */
import type { Booking, BookingStatus } from '../types';

/** Hours before the scheduled start after which nobody may cancel. */
export const CANCELLATION_CUTOFF_HOURS = 6;

const UPCOMING: BookingStatus[] = [
  'pending_payment',
  'confirmed',
  'assigned',
  'worker_en_route',
  'worker_arrived',
  'rematch_pending',
];

const IN_CARE: BookingStatus[] = ['in_progress'];

const CLOSED: BookingStatus[] = ['completed', 'cancelled', 'missed'];

const NEEDS_REVIEW: BookingStatus[] = ['disputed'];

export interface BookingBuckets {
  all: Booking[];
  upcoming: Booking[];
  inCare: Booking[];
  completed: Booking[];
  needsReview: Booking[];
}

export function bucketBookings(bookings: Booking[]): BookingBuckets {
  return {
    all: bookings,
    upcoming: bookings.filter((b) => UPCOMING.includes(b.rawStatus)),
    inCare: bookings.filter((b) => IN_CARE.includes(b.rawStatus)),
    completed: bookings.filter((b) => CLOSED.includes(b.rawStatus)),
    needsReview: bookings.filter((b) => NEEDS_REVIEW.includes(b.rawStatus)),
  };
}

export function isTerminal(status: BookingStatus): boolean {
  return CLOSED.includes(status);
}

/** True once a nurse has claimed the booking (so chat / tracking are live). */
export function hasAssignedNurse(b: Booking): boolean {
  return (
    !!b.nurseId &&
    b.nurseId !== 'unassigned' &&
    ['assigned', 'worker_en_route', 'worker_arrived', 'in_progress', 'completed'].includes(
      b.rawStatus,
    )
  );
}

/**
 * Scheduled start as a real instant.
 *
 * The backend stores date and time separately and treats the pair as UTC
 * (`datetime.combine(..., tzinfo=timezone.utc)` in bookings.py), so we build
 * the same instant here. Parsing it as local time would shift the cancellation
 * cutoff by the device's offset and let the two disagree about whether
 * cancelling is still allowed.
 */
export function scheduledStart(b: Booking): Date | null {
  if (b.scheduledStartISO) {
    const d = new Date(b.scheduledStartISO);
    return isNaN(d.getTime()) ? null : d;
  }
  if (!b.date) return null;
  const time = (b.slot || '00:00').padEnd(5, '0');
  const d = new Date(`${b.date}T${time}:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Milliseconds until the cancellation window shuts; negative once closed. */
export function msUntilCancellationCutoff(b: Booking, now = Date.now()): number | null {
  const start = scheduledStart(b);
  if (!start) return null;
  return start.getTime() - CANCELLATION_CUTOFF_HOURS * 3600_000 - now;
}

/**
 * Whether this booking may still be cancelled, matching the server's rule so
 * the UI never offers a button that will be refused with
 * `CANCELLATION_WINDOW_CLOSED`. Terminal bookings are never cancellable; an
 * unknown schedule is permissive and lets the server decide.
 */
export function canCancel(b: Booking, now = Date.now()): boolean {
  if (isTerminal(b.rawStatus) || b.rawStatus === 'draft') return false;
  const remaining = msUntilCancellationCutoff(b, now);
  return remaining === null || remaining > 0;
}

/** Nurse-side: cancelling re-offers the visit instead of ending it. */
export function canNurseCancel(b: Booking, now = Date.now()): boolean {
  return (
    ['assigned', 'worker_en_route', 'worker_arrived'].includes(b.rawStatus) && canCancel(b, now)
  );
}

export const CANCELLATION_CLOSED_MESSAGE =
  `Cancellation closed — visits can only be cancelled more than ${CANCELLATION_CUTOFF_HOURS} hours ` +
  `before the scheduled start. Contact support if you need help.`;

/** Human label for a backend status. */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Payment pending',
  confirmed: 'Finding a nurse',
  assigned: 'Nurse assigned',
  worker_en_route: 'Nurse on the way',
  worker_arrived: 'Nurse arrived',
  in_progress: 'Visit in progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  missed: 'Missed',
  rematch_pending: 'Finding a new nurse',
  disputed: 'Needs review',
};

/** Badge palette key for a backend status. */
export function badgeToneFor(status: BookingStatus): 'scheduled' | 'enroute' | 'active' | 'completed' | 'cancelled' {
  switch (status) {
    case 'worker_en_route':
      return 'enroute';
    case 'worker_arrived':
    case 'in_progress':
      return 'active';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'missed':
    case 'disputed':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}
