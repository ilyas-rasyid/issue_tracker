import { prisma } from '../infrastructure/database/prisma';
import { Client } from 'pg';
import { DAY } from '../lib/core';
import { removeObject, findOrphanObjects } from '../lib/services';
const dryRun = process.argv.includes('--dry-run');
const now = new Date(),
  after90 = new Date(now.getTime() - 90 * DAY),
  after365 = new Date(now.getTime() - 365 * DAY),
  orphanCutoff = new Date(now.getTime() - DAY);
let purgedIssues = 0,
  purgedComments = 0,
  purgedAttachments = 0,
  removedIssues = 0,
  failed = 0;
async function purgeAttachment(a: { id: string; storageKey: string | null }) {
  if (dryRun) {
    console.log(`[dry] purge attachment ${a.id}`);
    return;
  }
  if (a.storageKey) await removeObject(a.storageKey);
  await prisma.issueAttachment.updateMany({
    where: { id: a.id, purgedAt: null },
    data: { purgedAt: now, storageKey: null },
  });
  purgedAttachments++;
}
async function run() {
  const lockClient = new Client({ connectionString: process.env.DATABASE_URL });
  await lockClient.connect();
  const locked = await lockClient.query<{
    locked: boolean;
  }>('SELECT pg_try_advisory_lock(86503403) AS locked');
  if (!locked.rows[0]?.locked) {
    console.log('Another cleanup worker is active');
    await lockClient.end();
    return;
  }
  try {
    // Expired PENDING reservations are not counted as slots after 24h.
    if (!dryRun)
      await prisma.issueAttachment.updateMany({
        where: { status: 'PENDING', createdAt: { lte: orphanCutoff }, deletedAt: null },
        data: { status: 'FAILED', deletedAt: now },
      });
    for (let batch = 0; batch < 100; batch++) {
      const rows = await prisma.issueAttachment.findMany({
        where: {
          purgedAt: null,
          OR: [
            { deletedAt: { lte: after90 } },
            { issue: { deletedAt: { lte: after90 } } },
            { status: 'FAILED', createdAt: { lte: orphanCutoff } },
          ],
        },
        select: { id: true, storageKey: true },
        take: 100,
      });
      if (!rows.length) break;
      for (const a of rows) {
        try {
          await purgeAttachment(a);
        } catch (e) {
          failed++;
          console.error('Attachment cleanup failed', a.id, String(e));
        }
      }
      if (dryRun || failed >= 100) break;
    }
    for (let batch = 0; batch < 100; batch++) {
      const issues = await prisma.issue.findMany({
        where: { deletedAt: { lte: after90 }, purgedAt: null },
        take: 100,
        select: { id: true },
      });
      if (!issues.length) break;
      for (const i of issues) {
        try {
          if (dryRun) {
            console.log(`[dry] purge issue ${i.id}`);
            continue;
          }
          const pending = await prisma.issueAttachment.count({
            where: { issueId: i.id, storageKey: { not: null } },
          });
          if (pending) continue; // Storage cleanup must finish first.
          await prisma.$transaction(async (tx) => {
            await tx.issueActivity.updateMany({
              where: { issueId: i.id },
              data: { actorId: null },
            });
            await tx.comment.updateMany({
              where: { issueId: i.id },
              data: { content: '[removed]', authorId: null, purgedAt: now },
            });
            await tx.issue.updateMany({
              where: { id: i.id, purgedAt: null },
              data: {
                title: '[removed]',
                description: '',
                issueNumber: null,
                authorId: null,
                purgedAt: now,
              },
            });
          });
          purgedIssues++;
        } catch (e) {
          failed++;
          console.error('Issue purge failed', i.id, String(e));
        }
      }
      if (dryRun) break;
    }
    for (let batch = 0; batch < 100; batch++) {
      const comments = await prisma.comment.findMany({
        where: { purgedAt: null, deletedAt: { lte: after90 } },
        take: 100,
        select: { id: true },
      });
      if (!comments.length) break;
      if (dryRun) {
        console.log('[dry] purge comments', comments.length);
        break;
      }
      await prisma.comment.updateMany({
        where: { id: { in: comments.map((c) => c.id) } },
        data: { content: '[removed]', authorId: null, purgedAt: now },
      });
      purgedComments += comments.length;
    }
    for (let batch = 0; batch < 100; batch++) {
      const expired = await prisma.issue.findMany({
        where: { deletedAt: { lte: after365 } },
        take: 100,
        select: { id: true },
      });
      if (!expired.length) break;
      if (dryRun) {
        console.log('[dry] expire audit', expired.length);
        break;
      }
      for (const i of expired) {
        try {
          if (
            await prisma.issueAttachment.count({
              where: { issueId: i.id, storageKey: { not: null } },
            })
          )
            continue;
          await prisma.$transaction(async (tx) => {
            await tx.notification.deleteMany({ where: { issueId: i.id } });
            await tx.issueActivity.deleteMany({ where: { issueId: i.id } });
            await tx.comment.deleteMany({ where: { issueId: i.id } });
            await tx.issueAttachment.deleteMany({ where: { issueId: i.id } });
            await tx.issue.delete({ where: { id: i.id } });
          });
          removedIssues++;
        } catch (e) {
          failed++;
          console.error('Audit expiration failed', i.id, String(e));
        }
      }
      if (expired.length < 100) break;
    }
    if (!dryRun) {
      await prisma.authToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: after90 } }, { usedAt: { lt: after90 } }] },
      });
      await prisma.session.deleteMany({
        where: { OR: [{ absoluteExpiresAt: { lt: after90 } }, { revokedAt: { lt: after90 } }] },
      });
    }
    // S3 object sweep compares old keys with active DB references, covering crashes after upload.
    try {
      const orphaned = await findOrphanObjects(orphanCutoff, async (key) => {
        if (key.startsWith('avatar/'))
          return !!(await prisma.user.findFirst({
            where: { avatarKey: key, deletedAt: null },
            select: { id: true },
          }));
        return !!(await prisma.issueAttachment.findFirst({
          where: { storageKey: key },
          select: { id: true },
        }));
      });
      if (dryRun) console.log('[dry] storage orphans', orphaned.length);
      else
        for (const key of orphaned) {
          try {
            await removeObject(key);
          } catch (e) {
            failed++;
            console.error('Orphan removal failed', String(e));
          }
        }
    } catch (e) {
      failed++;
      console.error('Storage sweep unavailable', String(e));
    }
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(86503403)');
    await lockClient.end();
  }
}
try {
  await run();
  console.log(
    JSON.stringify({
      dryRun,
      purgedIssues,
      purgedComments,
      purgedAttachments,
      removedIssues,
      failed,
    }),
  );
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.error('Cleanup worker failed', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
