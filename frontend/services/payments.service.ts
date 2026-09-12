import { api } from '../lib/api';

export interface BackendPaymentOrder {
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number; // paise
  currency: string;
  booking_id: string;
}

export interface PaymentVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  booking_id: string;
}

export interface PaymentHistoryItem {
  booking_id: string;
  booking_ref: string;
  total_amount: number;
  payment_status: 'pending' | 'initiated' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';
  razorpay_payment_id: string | null;
  created_at: string;
}

export interface RefundResult {
  refunded: boolean;
  refund_id: string;
  status: string;
  amount: number;
}

/** A customer's tax invoice for one booking — the customer view only. It
 * never carries the internal 80/20 nurse/platform split; see
 * app/services/pricing_engine.customer_view on the backend. */
export interface InvoiceDetail {
  invoice_number: string;
  booking_ref: string;
  invoice_date: string | null;
  place_of_supply: string | null;
  line_items: Array<{
    label: string;
    sac_code: string | null;
    amount: string;
    gst_rate_pct: string;
    gst_amount: string;
    cgst_amount: string;
    sgst_amount: string;
    line_total: string;
    is_exempt: boolean;
    exemption_note: string | null;
  }>;
  taxable_value: number;
  exempt_value: number;
  cgst_amount: number;
  sgst_amount: number;
  total_gst: number;
  total_amount: number;
  pdf_url: string | null;
}

/** A nurse's "Payout Advice & Tax Invoice" for one released payment.
 * `payout_status` / `utr` reflect what Razorpay has actually confirmed, so an
 * in-flight transfer is never reported here as paid. */
export interface PayoutStatement {
  statement_number: string;
  booking_ref: string;
  generated_at: string | null;
  gross_earned: number;
  platform_fee: number;
  platform_fee_gst: number;
  net_take_home: number;
  total_deductions: number;
  final_disbursal: number;
  line_items: Array<{ label: string; amount: string; note?: string | null; type: string }>;
  payout_status: string;
  utr: string | null;
  paid_at: string | null;
  pdf_url: string | null;
}

export type PaymentMethodId = 'razorpay' | 'cash';

export interface PaymentMethodOption {
  method: PaymentMethodId;
  label: string;
  description: string;
  available: boolean;
  reason: string | null;
}

export interface PaymentMethodsOut {
  booking_id: string;
  amount: number;
  current_method: PaymentMethodId;
  methods: PaymentMethodOption[];
}

/** Authoritative payment + booking state for one booking. */
export interface PaymentState {
  verified: boolean;
  booking_id: string;
  booking_ref: string;
  booking_status: string;
  payment_status: string;
  razorpay_payment_id: string | null;
  idempotent_replay?: boolean;
  reconciled?: boolean;
  reason?: string;
  payment_method?: PaymentMethodId;
  /**
   * Booking is confirmed and dispatchable, money due at the visit.
   * `verified` is correctly false here — this is NOT a payment failure.
   */
  cash_due?: boolean;
}

export const paymentsService = {
  createOrder: (booking_id: string) =>
    api.post<BackendPaymentOrder>('/payments/order', { booking_id }),
  verify: (payload: PaymentVerifyPayload) =>
    api.post<PaymentState>('/payments/verify', payload),

  /** Read-only: what the backend believes about this booking's payment. */
  status: (booking_id: string) =>
    api.get<PaymentState>(`/payments/status/${booking_id}`),

  /**
   * Which payment methods this booking may use. Server-driven so adding or
   * restricting a method doesn't need an app release.
   */
  methods: (booking_id: string) =>
    api.get<PaymentMethodsOut>(`/payments/methods/${booking_id}`),

  /** Customer chooses cash-at-visit. Confirms the booking; no money moves yet. */
  selectCash: (booking_id: string) =>
    api.post<PaymentState>('/payments/cash/select', { booking_id }),

  /** Provider records cash taken at the visit. This is the revenue event. */
  collectCash: (booking_id: string, amount?: number) =>
    api.post<PaymentState>('/payments/cash/collect', { booking_id, amount }),

  /** Cash this provider is holding but has not yet remitted. */
  outstandingCash: () =>
    api.get<{ worker_id: string; outstanding_cash: number }>('/payments/cash/outstanding'),

  /**
   * Ask the backend to settle this booking against Razorpay's own record of
   * the order. Used when /verify did not return a clean success, so a
   * payment that actually went through is never reported to the customer as
   * a failure. The backend checks Razorpay, not us — this cannot fake a
   * successful payment.
   */
  reconcile: (booking_id: string) =>
    api.post<PaymentState>(`/payments/reconcile/${booking_id}`, {}),
  history: () => api.get<PaymentHistoryItem[]>('/payments/consumer/history'),

  /**
   * Cancel-with-refund. Also cancels the booking itself, and is refused with
   * `CANCELLATION_WINDOW_CLOSED` inside 6 hours of the scheduled start.
   */
  refund: (bookingId: string, amount: number, reason: string) =>
    api.post<RefundResult>(`/payments/refund/${bookingId}`, { amount, reason }),

  /** GET /api/payments/bookings/{id}/invoice — generates the invoice on
   * demand if a transient failure meant it was never created at payment
   * time, so a paid booking always yields a receipt. */
  invoice: (bookingId: string) =>
    api.get<InvoiceDetail>(`/payments/bookings/${bookingId}/invoice`),

  /** GET /api/payments/worker/payout-statements — the nurse's own payout
   * advices, newest first. */
  payoutStatements: () => api.get<PayoutStatement[]>('/payments/worker/payout-statements'),
};

/**
 * The backend runs Razorpay in mock mode whenever real credentials are absent
 * (MOCK_EXTERNAL_PROVIDERS, or a placeholder key). Opening the real checkout
 * against a mock order always fails, so callers short-circuit to /verify —
 * exactly what the web client does.
 */
export function isMockOrder(order: BackendPaymentOrder): boolean {
  return (
    !order.razorpay_key_id ||
    order.razorpay_key_id.endsWith('_placeholder') ||
    !!order.razorpay_order_id?.startsWith('order_mock_')
  );
}
