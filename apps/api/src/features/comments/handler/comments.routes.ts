import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  assert,
  validate,
  commentSchema,
  editCommentSchema,
  ISSUE_STATUS,
  ISSUE_ACTIVITY_TYPE,
  NOTIFICATION_TYPE,
  issueKey,
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorLimit,
  fingerprint,
  actorDto,
  isUniqueError,
} from '../../../lib/core';
import { requireUser, lockIssue, lockUser, limitRate } from '../../../lib/security';
import { activeIssue } from '../../issues/service/issue.mapper';
export const commentDto = (c: any) => ({
  id: c.id,
  issueKey: issueKey(c.issue?.issueNumber ?? 0),
  content: c.content,
  author: actorDto(c.author),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  isEdited: c.updatedAt.getTime() - c.createdAt.getTime() > 1000,
});
export const commentRoutes = new Elysia({ prefix: '/api/v1' })
  .get('/issues/:key/comments', async ({ params, request }) => {
    const issue = await activeIssue(params.key),
      url = new URL(request.url),
      limit = cursorLimit(url),
      scope = `comments:${issue.id}`;
    const cursor = decodeCursor(url.searchParams.get('cursor') || undefined, scope);
    const comments = await prisma.comment.findMany({
      where: {
        issueId: issue.id,
        deletedAt: null,
        author: { is: { deletedAt: null } },
        ...cursorWhere(cursor, 'asc'),
      },
      include: { author: true, issue: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const more = comments.length > limit,
      rows = comments.slice(0, limit);
    return {
      data: rows.map(commentDto),
      meta: {
        limit,
        hasMore: more,
        nextCursor:
          more && rows.length ? encodeCursor(rows.at(-1)!.createdAt, rows.at(-1)!.id, scope) : null,
      },
    };
  })
  .post('/issues/:key/comments', async ({ params, request }) => {
    limitRate(request, 'create-comment', 100, 3600000);
    const u = await requireUser(request, true),
      data = validate(commentSchema, await request.json());
    const issue = await activeIssue(params.key),
      hash = fingerprint({ issueId: issue.id, content: data.content });
    async function replay() {
      const existing = await prisma.comment.findUnique({
        where: { clientRequestId: data.clientRequestId },
        include: { author: true, issue: true },
      });
      if (!existing) return null;
      assert(
        existing.authorId === u.id && !existing.deletedAt && !existing.issue.deletedAt,
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Request key cannot be reused',
      );
      assert(
        existing.requestFingerprint === hash,
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Request key used with another payload',
      );
      return existing;
    }
    const prev = await replay();
    if (prev)
      return new Response(JSON.stringify({ data: commentDto(prev) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    let created: any;
    try {
      created = await prisma.$transaction(async (tx) => {
        await lockUser(tx, u.id);
        await lockIssue(tx, issue.id);
        const now = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
        assert(!now.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue was removed');
        assert(
          now.status !== ISSUE_STATUS.CLOSED,
          409,
          'ISSUE_CLOSED',
          'Comments are locked until the issue is reopened',
        );
        const comment = await tx.comment.create({
          data: {
            issueId: now.id,
            authorId: u.id,
            content: data.content,
            clientRequestId: data.clientRequestId,
            requestFingerprint: hash,
          },
        });
        await tx.issueActivity.create({
          data: { issueId: now.id, actorId: u.id, eventType: ISSUE_ACTIVITY_TYPE.COMMENT_ADDED },
        });
        if (now.authorId && now.authorId !== u.id) {
          await tx.notification.create({
            data: {
              recipientId: now.authorId,
              actorId: u.id,
              issueId: now.id,
              commentId: comment.id,
              type: NOTIFICATION_TYPE.ISSUE_COMMENTED,
            },
          });
        }
        return comment;
      });
    } catch (e) {
      if (isUniqueError(e)) {
        const existing = await replay();
        if (existing)
          return new Response(JSON.stringify({ data: commentDto(existing) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
      }
      throw e;
    }
    return new Response(JSON.stringify({ data: commentDto({ ...created, issue, author: u }) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  })
  .patch('/comments/:id', async ({ params, request }) => {
    const u = await requireUser(request),
      data = validate(editCommentSchema, await request.json());
    const found = await prisma.comment.findUnique({
      where: { id: params.id },
      include: { issue: true },
    });
    assert(
      found && !found.deletedAt && !found.issue.deletedAt,
      404,
      'COMMENT_NOT_FOUND',
      'Comment not found',
    );
    assert(
      found.authorId === u.id,
      403,
      'NOT_COMMENT_OWNER',
      'Only the author can edit this comment',
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockIssue(tx, found.issueId);
      const c = await tx.comment.findUniqueOrThrow({
        where: { id: found.id },
        include: { issue: true },
      });
      assert(
        !c.deletedAt && !c.issue.deletedAt,
        404,
        'COMMENT_NOT_FOUND',
        'Comment no longer available',
      );
      assert(c.issue.status !== ISSUE_STATUS.CLOSED, 409, 'ISSUE_CLOSED', 'Comments are locked');
      assert(
        c.authorId === u.id,
        403,
        'NOT_COMMENT_OWNER',
        'Only the author can edit this comment',
      );
      return c.content === data.content
        ? c
        : tx.comment.update({ where: { id: c.id }, data: { content: data.content } });
    });
    return { data: commentDto({ ...result, author: u }) };
  })
  .delete('/comments/:id', async ({ params, request }) => {
    const u = await requireUser(request);
    const found = await prisma.comment.findUnique({
      where: { id: params.id },
      include: { issue: true },
    });
    assert(
      found && !found.deletedAt && !found.issue.deletedAt,
      404,
      'COMMENT_NOT_FOUND',
      'Comment not found',
    );
    assert(
      found.authorId === u.id,
      403,
      'NOT_COMMENT_OWNER',
      'Only the author can delete this comment',
    );
    await prisma.$transaction(async (tx) => {
      await lockIssue(tx, found.issueId);
      const result = await tx.comment.updateMany({
        where: { id: found.id, deletedAt: null, authorId: u.id },
        data: { deletedAt: new Date() },
      });
      assert(result.count === 1, 404, 'COMMENT_NOT_FOUND', 'Comment not found');
    });
    return new Response(null, { status: 204 });
  });
