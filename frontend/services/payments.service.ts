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

export const paymentsService = {
  createOrder: (booking_id: string) =>
    api.post<BackendPaymentOrder>('/payments/order', { booking_id }),
  verify: (payload: PaymentVerifyPayload) =>
    api.post<{ verified: boolean; booking_status: string; payment_status: string }>(
      '/payments/verify',
      payload,
    ),
  history: () => api.get<PaymentHistoryItem[]>('/payments/consumer/history'),
};
