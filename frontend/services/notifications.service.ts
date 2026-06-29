import { api } from '../lib/api';
import type { BackendNotification } from './mappers';

export const notificationsService = {
  list: () => api.get<BackendNotification[]>('/notifications/'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
};
