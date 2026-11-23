import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  assert,
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorLimit,
  actorDto,
  issueKey,
} from '../../../lib/core';
import { requireUser } from '../../../lib/security';
export const visible = (id: string): any => ({
  recipientId: id,
  issue: { is: { deletedAt: null } },
  comment: { is: { deletedAt: null } },
});
export const dto = (n: any) => ({
  id: n.id,
  type: n.type,
  actor: actorDto(n.actor),
  issue: { key: issueKey(n.issue.issueNumber), title: n.issue.title },
  commentId: n.commentId,
  readAt: n.readAt,
  createdAt: n.createdAt,
});
export const notificationRoutes = new Elysia({ prefix: '/api/v1/notifications' })
  .get('/', async ({ request }) => {
    const u = await requireUser(request),
      url = new URL(request.url),
      limit = cursorLimit(url),
      scope = `notifications:${u.id}`;
    const cursor = decodeCursor(url.searchParams.get('cursor') || undefined, scope);
    const rows = await prisma.notification.findMany({
      where: { ...visible(u.id), ...cursorWhere(cursor, 'desc') },
      include: { actor: true, issue: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const more = rows.length > limit,
      records = rows.slice(0, limit);
    return {
      data: records.map(dto),
      meta: {
        limit,
        hasMore: more,
        nextCursor:
          more && records.length
            ? encodeCursor(records.at(-1)!.createdAt, records.at(-1)!.id, scope)
            : null,
      },
    };
  })
  .get('/unread-count', async ({ request }) => {
    const u = await requireUser(request);
    return {
      data: {
        count: await prisma.notification.count({ where: { ...visible(u.id), readAt: null } }),
      },
    };
  })
  .patch('/:id/read', async ({ params, request }) => {
    const u = await requireUser(request),
      n = await prisma.notification.findFirst({ where: { id: params.id, ...visible(u.id) } });
    assert(n, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
    const result = n.readAt
      ? n
      : await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    return { data: { id: result.id, readAt: result.readAt } };
  })
  .post('/mark-all-read', async ({ request }) => {
    const u = await requireUser(request),
      cutoff = new Date();
    const update = await prisma.notification.updateMany({
      where: { ...visible(u.id), readAt: null, createdAt: { lte: cutoff } },
      data: { readAt: cutoff },
    });
    const unread = await prisma.notification.count({ where: { ...visible(u.id), readAt: null } });
    return { data: { updatedCount: update.count, unreadCount: unread } };
  });
