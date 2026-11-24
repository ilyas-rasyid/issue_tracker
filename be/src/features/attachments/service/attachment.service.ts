import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert } from '../../../commons/errors/app-error';
import { ATTACHMENT_STATUS } from '../../../commons/constants/domain.constants';
import { activeIssue } from '../../issues/service/issue.mapper';
import { lockIssue } from '../../../infrastructure/database/locks';
import { normalizeImage } from '../../../infrastructure/storage/image-processing';
import {
  uploadObject,
  removeObject,
  readObject,
  storageKey,
} from '../../../infrastructure/storage/object-storage';

export const checkIssueAttachmentOwner = (issue: any, userId: string) => {
  assert(
    issue.authorId === userId,
    403,
    'NOT_ISSUE_OWNER',
    'Only the issue author can manage attachments',
  );
  assert(issue.status !== 'CLOSED', 409, 'ISSUE_CLOSED', 'Reopen the issue to manage attachments');
};

export const attachmentDto = (a: any, key: string) => ({
  id: a.id,
  issueKey: key,
  originalName: a.originalName,
  mimeType: a.mimeType,
  sizeBytes: a.sizeBytes,
  createdAt: a.createdAt,
  contentUrl: `/api/v1/issues/${key}/attachments/${a.id}/content`,
});

export async function listAttachments(key: string) {
  const issue = await activeIssue(key);
  const rows = await prisma.issueAttachment.findMany({
    where: { issueId: issue.id, deletedAt: null, status: ATTACHMENT_STATUS.READY },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((a) => attachmentDto(a, key));
}

export async function getAttachmentContent(key: string, attachmentId: string) {
  const issue = await activeIssue(key);
  const a = await prisma.issueAttachment.findFirst({
    where: {
      id: attachmentId,
      issueId: issue.id,
      deletedAt: null,
      status: ATTACHMENT_STATUS.READY,
    },
  });
  assert(a?.storageKey, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
  const bytes = await readObject(a.storageKey);
  assert(bytes, 404, 'ATTACHMENT_NOT_FOUND', 'Image not found');
  return bytes;
}

export async function uploadAttachment(userId: string, key: string, file: File) {
  const issue = await activeIssue(key);
  checkIssueAttachmentOwner(issue, userId);

  const bytes = await normalizeImage(file);
  const storagePath = storageKey('issue', issue.id);

  const reserved = await prisma.$transaction(async (tx) => {
    await lockIssue(tx, issue.id);
    const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
    assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed');
    checkIssueAttachmentOwner(latest, userId);
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
        storageKey: storagePath,
      },
    });
  });

  try {
    await uploadObject(storagePath, bytes);
    const finalized = await prisma.$transaction(async (tx) => {
      await lockIssue(tx, issue.id);
      const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
      assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed before upload finished');
      checkIssueAttachmentOwner(latest, userId);
      return tx.issueAttachment.update({
        where: { id: reserved.id },
        data: { status: ATTACHMENT_STATUS.READY, storageKey: storagePath },
      });
    });
    return attachmentDto(finalized, key);
  } catch (e) {
    await removeObject(storagePath).catch((err) =>
      console.error('Storage cleanup failed', String(err)),
    );
    await prisma.issueAttachment
      .updateMany({
        where: { id: reserved.id, status: ATTACHMENT_STATUS.PENDING },
        data: { status: ATTACHMENT_STATUS.FAILED, deletedAt: new Date() },
      })
      .catch(() => {
        // Best-effort cleanup. The next scheduled cleanup can retry.
      });
    if (e instanceof AppError) {
      throw e;
    }
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Image storage is temporarily unavailable');
  }
}

export async function deleteAttachment(userId: string, key: string, attachmentId: string) {
  const issue = await activeIssue(key);
  checkIssueAttachmentOwner(issue, userId);
  await prisma.$transaction(async (tx) => {
    await lockIssue(tx, issue.id);
    const latest = await tx.issue.findUniqueOrThrow({ where: { id: issue.id } });
    assert(!latest.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue removed');
    checkIssueAttachmentOwner(latest, userId);
    const result = await tx.issueAttachment.updateMany({
      where: {
        id: attachmentId,
        issueId: issue.id,
        deletedAt: null,
        status: ATTACHMENT_STATUS.READY,
      },
      data: { deletedAt: new Date() },
    });
    assert(result.count === 1, 404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
  });
}
