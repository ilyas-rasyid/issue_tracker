import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorLimit,
} from '../../../commons/pagination/pagination';
import { actorDto } from '../../../commons/mappers/user.mapper';
import { activeIssue } from '../../issues/service/issue.mapper';
export const activityRoutes = new Elysia({ prefix: '/api/v1/issues' }).get(
  '/:key/activities',
  async ({ params, request }) => {
    const issue = await activeIssue(params.key);
    const url = new URL(request.url);
    const limit = cursorLimit(url);
    const scope = `activities:${issue.id}`;
    const cursor = decodeCursor(url.searchParams.get('cursor') || undefined, scope);
    const events = await prisma.issueActivity.findMany({
      where: { issueId: issue.id, ...cursorWhere(cursor, 'desc') },
      include: { actor: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const more = events.length > limit;
    const rows = events.slice(0, limit);
    return {
      data: rows.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actor: actorDto(e.actor),
        oldValue: e.oldValue,
        newValue: e.newValue,
        createdAt: e.createdAt,
      })),
      meta: {
        limit,
        hasMore: more,
        nextCursor:
          more && rows.length ? encodeCursor(rows.at(-1)!.createdAt, rows.at(-1)!.id, scope) : null,
      },
    };
  },
);
