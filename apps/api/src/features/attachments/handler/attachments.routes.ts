import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert, ATTACHMENT_STATUS, issueKey } from '../../../lib/core';
import { requireUser, lockIssue, limitRate } from '../../../lib/security';
import { activeIssue } from '../../issues/service/issue.mapper';
import {
  normalizeImage,
  uploadObject,
  removeObject,
  readObject,
  storageKey,
} from '../../../lib/services';
export const checkOwner = (issue: any, userId: string) => {
  assert(
    issue.authorId === userId,
    403,
    'NOT_ISSUE_OWNER',
    'Only the issue author can manage attachments',
  );
  assert(issue.status !== 'CLOSED', 409, 'ISSUE_CLOSED', 'Reopen the issue to manage attachments');
};
export const toDto = (a: any, key: string) => ({
  id: a.id,
  issueKey: key,
  originalName: a.originalName,
  mimeType: a.mimeType,
  sizeBytes: a.sizeBytes,
  createdAt: a.createdAt,
  contentUrl: `/api/v1/issues/${key}/attachments/${a.id}/content`,
});
export const attachmentRoutes = new Elysia({ prefix: '/api/v1/issues' })
  .get('/:key/attachments', async ({ params }) => {
    const issue = await activeIssue(params.key);
    const rows = await prisma.issueAttachment.findMany({
      where: { issueId: issue.id, deletedAt: null, status: ATTACHMENT_STATUS.READY },
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows.map((a) => toDto(a, params.key)) };
  })
  .get('/:key/attachments/:id/content', async ({ params }) => {
    const issue = await activeIssue(params.key);
    const a = await prisma.issueAttachment.findFirst({
      where: { id: params.id, issueId: issue.id, deletedAt: null, status: ATTACHMENT_STATUS.READY },
    });
    assert(a?.storageKey, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    const bytes = await readObject(a.storageKey);
    assert(bytes, 404, 'ATTACHMENT_NOT_FOUND', 'Image not found');
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  })
  .post('/:key/attachments', async ({ params, request }) => {
    limitRate(request, 'upload-image', 120, 3600000);
    const u = await requireUser(request),
      issue = await activeIssue(params.key);
    checkOwner(issue, u.id);
    const size = Number(request.headers.get('content-length') || 0);
    assert(!size || size <= 6 * 1024 * 1024, 413, 'FILE_TOO_LARGE', 'Request exceeds upload limit');
    const form = await request.formData(),
      file = form.get('file');
    assert(file instanceof File, 422, 'VALIDATION_ERROR', 'Select one image file');
    const bytes = await normalizeImage(file),
      key = storageKey('issue', issue.id),
      reserved = await prisma.$transaction(async (tx) => {
        await lockIssue(tx, issue.id);
        const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
        assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed');
        checkOwner(latest, u.id);
        const count = await tx.issueAttachment.count({
          where: {
            issueId: issue.id,
            deletedAt: null,
            status: { in: [ATTACHMENT_STATUS.PENDING, ATTACHMENT_STATUS.READY] },
          },
        });
        assert(count < 5, 409, 'ATTACHMENT_LIMIT_REACHED', 'Maximum five images per issue');
        return tx.issueAttachment.create({
          data: {
            issueId: issue.id,
            originalName: file.name.slice(0, 255),
            mimeType: 'image/webp',
            sizeBytes: bytes.byteLength,
            status: ATTACHMENT_STATUS.PENDING,
            storageKey: key,
          },
        });
      });
    try {
      await uploadObject(key, bytes);
      const finalized = await prisma.$transaction(async (tx) => {
        await lockIssue(tx, issue.id);
        const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
        assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed before upload finished');
        checkOwner(latest, u.id);
        return tx.issueAttachment.update({
          where: { id: reserved.id },
          data: { status: ATTACHMENT_STATUS.READY, storageKey: key },
        });
      });
      return new Response(JSON.stringify({ data: toDto(finalized, params.key) }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      await removeObject(key).catch((err) => console.error('Storage cleanup failed', String(err)));
      await prisma.issueAttachment
        .updateMany({
          where: { id: reserved.id, status: ATTACHMENT_STATUS.PENDING },
          data: { status: ATTACHMENT_STATUS.FAILED, deletedAt: new Date() },
        })
        .catch(() => {});
      if (e instanceof AppError) throw e;
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Image storage is temporarily unavailable');
    }
  })
  .delete('/:key/attachments/:id', async ({ params, request }) => {
    const u = await requireUser(request),
      issue = await activeIssue(params.key);
    checkOwner(issue, u.id);
    await prisma.$transaction(async (tx) => {
      await lockIssue(tx, issue.id);
      const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
      assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed');
      checkOwner(latest, u.id);
      const result = await tx.issueAttachment.updateMany({
        where: {
          id: params.id,
          issueId: issue.id,
          deletedAt: null,
          status: ATTACHMENT_STATUS.READY,
        },
        data: { deletedAt: new Date() },
      });
      assert(result.count === 1, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    });
    return new Response(null, { status: 204 });
  });
