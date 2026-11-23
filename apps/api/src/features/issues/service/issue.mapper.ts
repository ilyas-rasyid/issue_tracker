import { prisma } from '../../../infrastructure/database/prisma';
import { assert, issueKey, parseIssueKey, TRANSITIONS, actorDto } from '../../../lib/core';
export const activeIssue = async (key: string) => {
  const n = parseIssueKey(key);
  const issue = await prisma.issue.findUnique({
    where: { issueNumber: n },
    include: { author: true },
  });
  assert(issue && !issue.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue not found');
  return issue;
};
export const issueDto = (v: any, detail = false) => ({
  id: v.id,
  key: issueKey(v.issueNumber),
  title: v.title,
  description: detail ? v.description : undefined,
  type: v.type,
  status: v.status,
  priority: v.priority,
  version: v.version,
  project:
    v.project && !v.project.deletedAt
      ? { id: v.project.id, slug: v.project.slug, name: v.project.name }
      : null,
  author: actorDto(v.author),
  createdAt: v.createdAt,
  updatedAt: v.updatedAt,
  ...(detail
    ? {
        attachments:
          v.attachments
            ?.filter((a: any) => !a.deletedAt && a.status === 'READY')
            .map((a: any) => ({
              id: a.id,
              originalName: a.originalName,
              sizeBytes: a.sizeBytes,
              mimeType: a.mimeType,
              contentUrl: `/api/v1/issues/${issueKey(v.issueNumber)}/attachments/${a.id}/content`,
              createdAt: a.createdAt,
            })) || [],
        commentCount: v._count?.comments ?? 0,
        allowedTransitions: TRANSITIONS[v.status as keyof typeof TRANSITIONS],
      }
    : {}),
});
