import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  assert,
  validate,
  createIssueSchema,
  editIssueSchema,
  statusSchema,
  issueKey,
  ISSUE_STATUS,
  ISSUE_ACTIVITY_TYPE,
  TRANSITIONS,
  fingerprint,
  isUniqueError,
} from '../../../lib/core';
import { requireUser, lockIssue, lockUser, limitRate } from '../../../lib/security';
import { activeIssue, issueDto } from '../service/issue.mapper';
export const issueWriteRoutes = new Elysia({ prefix: '/api/v1/issues' })
  .post('/', async ({ request }) => {
    limitRate(request, 'create-issue', 40, 3600000);
    const user = await requireUser(request, true),
      data = validate(createIssueSchema, await request.json());
    const hash = fingerprint({
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
    });
    async function replay() {
      const existing = await prisma.issue.findUnique({
        where: { clientRequestId: data.clientRequestId },
        include: { author: true, project: true },
      });
      if (!existing) return null;
      assert(
        existing.authorId === user.id && !existing.deletedAt,
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
    const previous = await replay();
    if (previous)
      return new Response(JSON.stringify({ data: issueDto(previous, true) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    let resolvedProject: any = null;
    if (data.projectId) {
      resolvedProject = await prisma.project.findFirst({
        where: { id: data.projectId, deletedAt: null },
      });
      assert(resolvedProject, 404, 'PROJECT_NOT_FOUND', 'Selected project not found');
    } else if (data.projectId === undefined) {
      resolvedProject = await prisma.project.findFirst({
        where: { slug: 'general', deletedAt: null },
      });
    }
    let created: any;
    try {
      created = await prisma.$transaction(async (tx) => {
        await lockUser(tx, user.id);
        const issue = await tx.issue.create({
          data: {
            projectId: resolvedProject?.id ?? null,
            title: data.title,
            description: data.description,
            type: data.type,
            priority: data.priority,
            status: ISSUE_STATUS.OPEN,
            authorId: user.id,
            clientRequestId: data.clientRequestId,
            requestFingerprint: hash,
          },
        });
        await tx.issueActivity.create({
          data: {
            issueId: issue.id,
            actorId: user.id,
            eventType: ISSUE_ACTIVITY_TYPE.ISSUE_CREATED,
          },
        });
        return issue;
      });
    } catch (e) {
      if (isUniqueError(e)) {
        const existing = await replay();
        if (existing)
          return new Response(JSON.stringify({ data: issueDto(existing, true) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
      }
      throw e;
    }
    return new Response(
      JSON.stringify({
        data: issueDto(
          { ...created, author: user, project: resolvedProject, attachments: [] },
          true,
        ),
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          Location: `/api/v1/issues/${issueKey(created.issueNumber)}`,
        },
      },
    );
  })
  .patch('/:key', async ({ params, request }) => {
    const u = await requireUser(request),
      data = validate(editIssueSchema, await request.json());
    const old = await activeIssue(params.key);
    assert(old.authorId === u.id, 403, 'NOT_ISSUE_OWNER', 'Only the issue author can edit');
    const updated = await prisma.$transaction(async (tx) => {
      await lockIssue(tx, old.id);
      const now = await tx.issue.findUniqueOrThrow({ where: { id: old.id } });
      assert(!now.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue not found');
      assert(
        now.version === data.expectedVersion,
        409,
        'VERSION_CONFLICT',
        'This issue changed in another session',
      );
      assert(
        now.status !== ISSUE_STATUS.CLOSED,
        409,
        'ISSUE_CLOSED',
        'Reopen the issue before editing',
      );
      assert(now.authorId === u.id, 403, 'NOT_ISSUE_OWNER', 'Only the issue author can edit');
      const changes: any = {};
      for (const field of ['projectId', 'title', 'description', 'type', 'priority'] as const) {
        if (data[field] !== undefined && data[field] !== now[field]) changes[field] = data[field];
      }
      if (changes.projectId) {
        const targetProject = await tx.project.findFirst({
          where: { id: changes.projectId, deletedAt: null },
        });
        assert(targetProject, 404, 'PROJECT_NOT_FOUND', 'Selected project not found');
      }
      if (!Object.keys(changes).length)
        return tx.issue.findUniqueOrThrow({ where: { id: now.id }, include: { project: true } });
      const result = await tx.issue.updateMany({
        where: { id: now.id, version: data.expectedVersion, deletedAt: null },
        data: { ...changes, version: { increment: 1 } },
      });
      assert(result.count === 1, 409, 'VERSION_CONFLICT', 'Issue changed before saving');
      for (const [field, eventType] of [
        ['type', ISSUE_ACTIVITY_TYPE.TYPE_CHANGED],
        ['priority', ISSUE_ACTIVITY_TYPE.PRIORITY_CHANGED],
      ] as const) {
        if (changes[field])
          await tx.issueActivity.create({
            data: {
              issueId: now.id,
              actorId: u.id,
              eventType,
              oldValue: now[field],
              newValue: changes[field],
            },
          });
      }
      return tx.issue.findUniqueOrThrow({ where: { id: now.id }, include: { project: true } });
    });
    return { data: issueDto({ ...updated, author: u }, true) };
  })
  .patch('/:key/status', async ({ params, request }) => {
    const u = await requireUser(request),
      data = validate(statusSchema, await request.json());
    const old = await activeIssue(params.key);
    assert(
      old.authorId === u.id,
      403,
      'NOT_ISSUE_OWNER',
      'Only the issue author can change status',
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockIssue(tx, old.id);
      const now = await tx.issue.findUniqueOrThrow({ where: { id: old.id } });
      assert(!now.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue not found');
      assert(
        now.version === data.expectedVersion,
        409,
        'VERSION_CONFLICT',
        'This issue changed in another session',
      );
      assert(
        now.authorId === u.id,
        403,
        'NOT_ISSUE_OWNER',
        'Only the issue author can change status',
      );
      if (data.status === now.status) return { issue: now, previous: now.status };
      assert(
        TRANSITIONS[now.status as keyof typeof TRANSITIONS]?.includes(data.status),
        409,
        'INVALID_STATUS_TRANSITION',
        'Transition is not allowed',
      );
      const updated = await tx.issue.updateMany({
        where: { id: now.id, version: now.version, status: now.status, deletedAt: null },
        data: { status: data.status, version: { increment: 1 } },
      });
      assert(updated.count === 1, 409, 'VERSION_CONFLICT', 'Issue changed before saving');
      await tx.issueActivity.create({
        data: {
          issueId: now.id,
          actorId: u.id,
          eventType: ISSUE_ACTIVITY_TYPE.STATUS_CHANGED,
          oldValue: now.status,
          newValue: data.status,
        },
      });
      return {
        issue: await tx.issue.findUniqueOrThrow({ where: { id: now.id } }),
        previous: now.status,
      };
    });
    return {
      data: {
        key: issueKey(result.issue.issueNumber!),
        status: result.issue.status,
        previousStatus: result.previous,
        version: result.issue.version,
        allowedTransitions: TRANSITIONS[result.issue.status as keyof typeof TRANSITIONS],
        updatedAt: result.issue.updatedAt,
      },
    };
  })
  .delete('/:key', async ({ params, request }) => {
    const u = await requireUser(request),
      issue = await activeIssue(params.key);
    assert(
      issue.authorId === u.id,
      403,
      'NOT_ISSUE_OWNER',
      'Only the author can delete this issue',
    );
    const when = new Date();
    await prisma.$transaction(async (tx) => {
      await lockIssue(tx, issue.id);
      const update = await tx.issue.updateMany({
        where: { id: issue.id, deletedAt: null, authorId: u.id },
        data: { deletedAt: when },
      });
      assert(update.count === 1, 404, 'ISSUE_NOT_FOUND', 'Issue already removed');
      await tx.issueActivity.updateMany({
        where: { issueId: issue.id },
        data: { auditExpiresAt: new Date(when.getTime() + 365 * 86400000) },
      });
      await tx.notification.deleteMany({ where: { issueId: issue.id } });
    });
    return new Response(null, { status: 204 });
  });
