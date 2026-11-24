import { prisma } from '../../../infrastructure/database/prisma';
import { assert, isUniqueError } from '../../../commons/errors/app-error';
import {
  type CreateIssueInput,
  type EditIssueInput,
  type StatusInput,
} from '../../../commons/validation/schemas';
import { issueKey } from '../../../commons/utils/issue-key';
import {
  ISSUE_STATUS,
  ISSUE_ACTIVITY_TYPE,
  TRANSITIONS,
} from '../../../commons/constants/domain.constants';
import { fingerprint } from '../../../commons/security/crypto';
import { lockIssue, lockUser } from '../../../infrastructure/database/locks';
import { activeIssue, issueDto } from './issue.mapper';

export type UserContext = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  emailVerifiedAt: Date | null;
};

export async function createIssue(user: UserContext, data: CreateIssueInput) {
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
    if (!existing) {
      return null;
    }
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
  if (previous) {
    return { issue: previous, isReplay: true };
  }

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
      if (existing) {
        return { issue: existing, isReplay: true };
      }
    }
    throw e;
  }

  return {
    issue: { ...created, author: user, project: resolvedProject, attachments: [] },
    isReplay: false,
  };
}

export async function updateIssue(user: UserContext, key: string, data: EditIssueInput) {
  const old = await activeIssue(key);
  assert(old.authorId === user.id, 403, 'NOT_ISSUE_OWNER', 'Only the issue author can edit');

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
    assert(now.authorId === user.id, 403, 'NOT_ISSUE_OWNER', 'Only the issue author can edit');

    const changes: Record<string, any> = {};
    for (const field of ['projectId', 'title', 'description', 'type', 'priority'] as const) {
      if (data[field] !== undefined && data[field] !== (now as any)[field]) {
        changes[field] = data[field];
      }
    }
    if (changes.projectId) {
      const targetProject = await tx.project.findFirst({
        where: { id: changes.projectId, deletedAt: null },
      });
      assert(targetProject, 404, 'PROJECT_NOT_FOUND', 'Selected project not found');
    }
    if (!Object.keys(changes).length) {
      return tx.issue.findUniqueOrThrow({ where: { id: now.id }, include: { project: true } });
    }
    const result = await tx.issue.updateMany({
      where: { id: now.id, version: data.expectedVersion, deletedAt: null },
      data: { ...changes, version: { increment: 1 } },
    });
    assert(result.count === 1, 409, 'VERSION_CONFLICT', 'Issue changed before saving');

    for (const [field, eventType] of [
      ['type', ISSUE_ACTIVITY_TYPE.TYPE_CHANGED],
      ['priority', ISSUE_ACTIVITY_TYPE.PRIORITY_CHANGED],
    ] as const) {
      if (changes[field]) {
        await tx.issueActivity.create({
          data: {
            issueId: now.id,
            actorId: user.id,
            eventType,
            oldValue: (now as any)[field],
            newValue: changes[field],
          },
        });
      }
    }
    return tx.issue.findUniqueOrThrow({ where: { id: now.id }, include: { project: true } });
  });

  return issueDto({ ...updated, author: user }, true);
}

export async function changeIssueStatus(user: UserContext, key: string, data: StatusInput) {
  const old = await activeIssue(key);
  assert(
    old.authorId === user.id,
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
      now.authorId === user.id,
      403,
      'NOT_ISSUE_OWNER',
      'Only the issue author can change status',
    );
    if (data.status === now.status) {
      return { issue: now, previous: now.status };
    }
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
        actorId: user.id,
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
    key: issueKey(result.issue.issueNumber!),
    status: result.issue.status,
    previousStatus: result.previous,
    version: result.issue.version,
    allowedTransitions: TRANSITIONS[result.issue.status as keyof typeof TRANSITIONS],
    updatedAt: result.issue.updatedAt,
  };
}

export async function deleteIssue(user: UserContext, key: string) {
  const issue = await activeIssue(key);
  assert(
    issue.authorId === user.id,
    403,
    'NOT_ISSUE_OWNER',
    'Only the author can delete this issue',
  );
  const when = new Date();
  await prisma.$transaction(async (tx) => {
    await lockIssue(tx, issue.id);
    const update = await tx.issue.updateMany({
      where: { id: issue.id, deletedAt: null, authorId: user.id },
      data: { deletedAt: when },
    });
    assert(update.count === 1, 404, 'ISSUE_NOT_FOUND', 'Issue already removed');
    await tx.issueActivity.updateMany({
      where: { issueId: issue.id },
      data: { auditExpiresAt: new Date(when.getTime() + 365 * 86400000) },
    });
    await tx.notification.deleteMany({ where: { issueId: issue.id } });
  });
}
