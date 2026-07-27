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

export const paymentsService = {
  createOrder: (booking_id: string) =>
    api.post<BackendPaymentOrder>('/payments/order', { booking_id }),
  verify: (payload: PaymentVerifyPayload) =>
    api.post<{ verified: boolean; booking_status: string; payment_status: string }>(
      '/payments/verify',
      payload,
    ),
  history: () => api.get<PaymentHistoryItem[]>('/payments/consumer/history'),

  /**
   * Cancel-with-refund. Also cancels the booking itself, and is refused with
   * `CANCELLATION_WINDOW_CLOSED` inside 6 hours of the scheduled start.
   */
  refund: (bookingId: string, amount: number, reason: string) =>
    api.post<RefundResult>(`/payments/refund/${bookingId}`, { amount, reason }),
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
