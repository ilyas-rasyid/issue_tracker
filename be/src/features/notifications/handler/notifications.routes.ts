import { Elysia } from 'elysia';
import { requireUser } from '../../../security/session';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../service/notification.service';

/** Notification endpoints. */
export const notificationRoutes = new Elysia({ prefix: '/api/v1/notifications' })
  .get('/', async ({ request }) => {
    const user = await requireUser(request);
    return listNotifications(user.id, new URL(request.url));
  })
  .get('/unread-count', async ({ request }) => {
    const user = await requireUser(request);
    const data = await getUnreadNotificationCount(user.id);
    return { data };
  })
  .patch('/:id/read', async ({ params, request }) => {
    const user = await requireUser(request);
    const data = await markNotificationAsRead(user.id, params.id);
    return { data };
  })
  .post('/mark-all-read', async ({ request }) => {
    const user = await requireUser(request);
    const data = await markAllNotificationsAsRead(user.id);
    return { data };
  });
