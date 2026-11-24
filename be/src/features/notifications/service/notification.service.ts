import { prisma } from '../../../infrastructure/database/prisma';
import { assert } from '../../../commons/errors/app-error';
import {
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorLimit,
} from '../../../commons/pagination/pagination';
import { actorDto } from '../../../commons/mappers/user.mapper';
import { issueKey } from '../../../commons/utils/issue-key';

export const visibleNotification = (id: string) => ({
  recipientId: id,
  issue: { is: { deletedAt: null } },
  comment: { is: { deletedAt: null } },
});

export const notificationDto = (n: any) => ({
  id: n.id,
  type: n.type,
  actor: actorDto(n.actor),
  issue: { key: issueKey(n.issue.issueNumber), title: n.issue.title },
  commentId: n.commentId,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

export async function listNotifications(userId: string, url: URL) {
  const limit = cursorLimit(url);
  const scope = `notifications:${userId}`;
  const cursor = decodeCursor(url.searchParams.get('cursor') || undefined, scope);
  const rows = await prisma.notification.findMany({
    where: { ...visibleNotification(userId), ...cursorWhere(cursor, 'desc') },
    include: { actor: true, issue: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const more = rows.length > limit;
  const records = rows.slice(0, limit);
  return {
    data: records.map(notificationDto),
    meta: {
      limit,
      hasMore: more,
      nextCursor:
        more && records.length
          ? encodeCursor(records.at(-1)!.createdAt, records.at(-1)!.id, scope)
          : null,
    },
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const count = await prisma.notification.count({
    where: { ...visibleNotification(userId), readAt: null },
  });
  return { count };
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findFirst({
    where: { id: notificationId, ...visibleNotification(userId) },
  });
  assert(n, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  const result = n.readAt
    ? n
    : await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  return { id: result.id, readAt: result.readAt };
}

export async function markAllNotificationsAsRead(userId: string) {
  const cutoff = new Date();
  const update = await prisma.notification.updateMany({
    where: { ...visibleNotification(userId), readAt: null, createdAt: { lte: cutoff } },
    data: { readAt: cutoff },
  });
  const unread = await prisma.notification.count({
    where: { ...visibleNotification(userId), readAt: null },
  });
  return { updatedCount: update.count, unreadCount: unread };
}
