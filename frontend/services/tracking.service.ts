import { api } from '../lib/api';
import { createWS } from '../lib/ws';

export interface LocationPing {
  booking_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

export const trackingService = {
  ping: (p: LocationPing) => api.post('/tracking/location', p),
  getLatest: (bookingId: string) =>
    api.get(`/tracking/booking/${bookingId}/latest`),
  subscribeToBooking: (
  bookingId: string,
  handlers: {
    onMessage: (m: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }
) =>
  createWS(`/api/ws/booking/${bookingId}`, handlers),

subscribeUser: (handlers: { onMessage: (m: any) => void }) =>
  createWS('/api/ws/user', handlers),
  };
