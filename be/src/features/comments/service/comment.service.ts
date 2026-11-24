import { prisma } from '../../../infrastructure/database/prisma';
import { assert, isUniqueError } from '../../../commons/errors/app-error';
import { type CommentInput, type EditCommentInput } from '../../../commons/validation/schemas';
import {
  ISSUE_STATUS,
  ISSUE_ACTIVITY_TYPE,
  NOTIFICATION_TYPE,
} from '../../../commons/constants/domain.constants';
import {
  encodeCursor,
  decodeCursor,
  cursorWhere,
  cursorLimit,
} from '../../../commons/pagination/pagination';
import { fingerprint } from '../../../commons/security/crypto';
import { lockIssue, lockUser } from '../../../infrastructure/database/locks';
import { activeIssue } from '../../issues/service/issue.mapper';
import { commentDto } from './comment.mapper';

export type UserContext = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  emailVerifiedAt: Date | null;
};

export async function listComments(key: string, url: URL) {
  const issue = await activeIssue(key);
  const limit = cursorLimit(url);
  const scope = `comments:${issue.id}`;
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

  const more = comments.length > limit;
  const rows = comments.slice(0, limit);

  return {
    data: rows.map(commentDto),
    meta: {
      limit,
      hasMore: more,
      nextCursor:
        more && rows.length ? encodeCursor(rows.at(-1)!.createdAt, rows.at(-1)!.id, scope) : null,
    },
  };
}

export async function createComment(user: UserContext, key: string, data: CommentInput) {
  const issue = await activeIssue(key);
  const hash = fingerprint({ issueId: issue.id, content: data.content });

  async function replay() {
    const existing = await prisma.comment.findUnique({
      where: { clientRequestId: data.clientRequestId },
      include: { author: true, issue: true },
    });
    if (!existing) {
      return null;
    }
    assert(
      existing.authorId === user.id && !existing.deletedAt && !existing.issue.deletedAt,
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
  if (prev) {
    return { comment: prev, isReplay: true };
  }

  let created: any;
  try {
    created = await prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
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
          authorId: user.id,
          content: data.content,
          clientRequestId: data.clientRequestId,
          requestFingerprint: hash,
        },
      });
      await tx.issueActivity.create({
        data: { issueId: now.id, actorId: user.id, eventType: ISSUE_ACTIVITY_TYPE.COMMENT_ADDED },
      });
      if (now.authorId && now.authorId !== user.id) {
        await tx.notification.create({
          data: {
            recipientId: now.authorId,
            actorId: user.id,
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
      if (existing) {
        return { comment: existing, isReplay: true };
      }
    }
    throw e;
  }

  return { comment: { ...created, issue, author: user }, isReplay: false };
}

export async function updateComment(user: UserContext, commentId: string, data: EditCommentInput) {
  const found = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { issue: true },
  });
  assert(
    found && !found.deletedAt && !found.issue.deletedAt,
    404,
    'COMMENT_NOT_FOUND',
    'Comment not found',
  );
  assert(
    found.authorId === user.id,
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
      c.authorId === user.id,
      403,
      'NOT_COMMENT_OWNER',
      'Only the author can edit this comment',
    );
    return c.content === data.content
      ? c
      : tx.comment.update({ where: { id: c.id }, data: { content: data.content } });
  });

  return commentDto({ ...result, author: user });
}

export async function deleteComment(user: UserContext, commentId: string) {
  const found = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { issue: true },
  });
  assert(
    found && !found.deletedAt && !found.issue.deletedAt,
    404,
    'COMMENT_NOT_FOUND',
    'Comment not found',
  );
  assert(
    found.authorId === user.id,
    403,
    'NOT_COMMENT_OWNER',
    'Only the author can delete this comment',
  );

  await prisma.$transaction(async (tx) => {
    await lockIssue(tx, found.issueId);
    const result = await tx.comment.updateMany({
      where: { id: found.id, deletedAt: null, authorId: user.id },
      data: { deletedAt: new Date() },
    });
    assert(result.count === 1, 404, 'COMMENT_NOT_FOUND', 'Comment not found');
  });
}
