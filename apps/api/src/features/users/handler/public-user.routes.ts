import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import { assert } from '../../../lib/core';
import { readObject } from '../../../lib/services';
export const publicUserRoutes = new Elysia({ prefix: '/api/v1/users' })
  .get('/:username', async ({ params }) => {
    const u = await prisma.user.findFirst({
      where: { username: params.username.toLowerCase(), deletedAt: null },
    });
    assert(u, 404, 'USER_NOT_FOUND', 'User not found');
    const groups = await prisma.issue.groupBy({
      by: ['status'],
      where: { authorId: u.id, deletedAt: null },
      _count: { _all: true },
    });
    const stats: Record<string, number> = {
      totalIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      resolvedIssues: 0,
      closedIssues: 0,
    };
    for (const row of groups) {
      const count = row._count._all;
      stats.totalIssues += count;
      const field =
        row.status === 'OPEN'
          ? 'openIssues'
          : row.status === 'IN_PROGRESS'
            ? 'inProgressIssues'
            : row.status === 'RESOLVED'
              ? 'resolvedIssues'
              : 'closedIssues';
      stats[field] += count;
    }
    return {
      data: {
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        githubUrl: u.githubUrl,
        avatarUrl: u.avatarKey ? `/api/v1/users/${u.username}/avatar` : null,
        joinedAt: u.createdAt,
        stats,
      },
    };
  })
  .get('/:username/avatar', async ({ params }) => {
    const u = await prisma.user.findFirst({
      where: { username: params.username.toLowerCase(), deletedAt: null },
    });
    assert(u?.avatarKey, 404, 'RESOURCE_NOT_FOUND', 'Avatar not found');
    const bytes = await readObject(u.avatarKey);
    assert(bytes, 404, 'RESOURCE_NOT_FOUND', 'Avatar not found');
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
