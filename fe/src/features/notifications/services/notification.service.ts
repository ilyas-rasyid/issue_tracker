import { api, mutate, type Notification, type InfinitePage } from '../../../shared/api/index';

export function fetchNotifications(cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api<InfinitePage<Notification>>(`/notifications${query}`);
}

export function fetchUnreadNotificationCount() {
  return api<{ data: { count: number } }>('/notifications/unread-count').then(
    (res) => res.data.count,
  );
}

export function markNotificationAsRead(id: string) {
  return mutate<{ id: string; readAt: string }>(`/notifications/${id}/read`, 'PATCH');
}

export function markAllNotificationsAsRead() {
  return mutate<{ updatedCount: number; unreadCount: number }>(
    '/notifications/mark-all-read',
    'POST',
  );
}
