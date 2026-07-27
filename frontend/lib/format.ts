/** Shared display formatting. */

/**
 * Format a bare `YYYY-MM-DD` date.
 *
 * Parsed as local rather than via `new Date("2026-07-26")`, which the JS spec
 * treats as UTC midnight — in any timezone behind UTC that renders as the
 * previous day, so a visit booked for the 26th would show as the 25th.
 */
export function formatDay(
  ymd: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}

/** "14:30" -> "2:30 PM". Accepts "HH:MM" or "HH:MM:SS". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return '—';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(mStr ?? '00').padStart(2, '0')} ${period}`;
}

/** "2:30 PM" -> "14:30:00", the shape the booking API expects. */
export function to24HourTime(display: string): string {
  const m = display.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return display;
  let h = Number(m[1]);
  const mins = m[2];
  const period = m[3]?.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mins}:00`;
}

/** Rupees with Indian digit grouping. */
export function inr(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** "3 hours ago", "in 2 days", "just now". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const future = diffMs > 0;

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
  ];
  if (abs < 60_000) return 'just now';

  let value = Math.round(abs / 60_000);
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  for (const [ms, u] of units) {
    if (abs >= ms) {
      value = Math.round(abs / ms);
      unit = u;
    }
  }
  const plural = value === 1 ? unit : `${unit}s`;
  return future ? `in ${value} ${plural}` : `${value} ${plural} ago`;
}

/** "4h 30m" from a minute count. */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Turn snake_case backend identifiers into readable labels. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
