import { Elysia } from 'elysia';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  validate,
  profileSchema,
  deleteAccountSchema,
  passwordSchema,
  emailSchema,
  AppError,
  assert,
  addDays,
  isUniqueError,
} from '../../../lib/core';
import {
  requireUser,
  requireSession,
  logoutResponse,
  authResponse,
  makeSession,
  lockUser,
  limitRate,
} from '../../../lib/security';
import { issueToken, deliver } from '../../auth/service/auth-token.service';
import { AUTH_TOKEN_PURPOSE, sha256 } from '../../../lib/core';
import { normalizeImage, uploadObject, removeObject, storageKey } from '../../../lib/services';
export const site = () => process.env.APP_ORIGIN || 'http://localhost:5173';
export const accountRoutes = new Elysia({ prefix: '/api/v1/account' })
  .patch('/profile', async ({ request }) => {
    const u = await requireUser(request),
      data = validate(profileSchema, await request.json());
    assert(Object.keys(data).length > 0, 422, 'VALIDATION_ERROR', 'At least one field is required');
    const next = await prisma.user.update({ where: { id: u.id }, data });
    return {
      data: {
        username: next.username,
        displayName: next.displayName,
        bio: next.bio,
        githubUrl: next.githubUrl,
        avatarUrl: next.avatarKey ? `/api/v1/users/${next.username}/avatar` : null,
        updatedAt: next.updatedAt,
      },
    };
  })
  .post('/change-password', async ({ request }) => {
    limitRate(request, 'change-password', 10, 3600000);
    const s = await requireSession(request);
    const data = validate(
      z.strictObject({ currentPassword: z.string(), newPassword: passwordSchema }),
      await request.json(),
    );
    assert(
      !!s.user.passwordHash &&
        (await Bun.password.verify(data.currentPassword, s.user.passwordHash)),
      403,
      'INVALID_PASSWORD',
      'Current password is incorrect',
    );
    const hash = await Bun.password.hash(data.newPassword, { algorithm: 'argon2id' });
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, s.user.id);
      await tx.user.update({ where: { id: s.user.id }, data: { passwordHash: hash } });
      await tx.session.deleteMany({ where: { userId: s.user.id, id: { not: s.id } } });
      await tx.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    });
    return authResponse({ message: 'Password changed' }, await makeSession(s.user.id));
  })
  .post('/change-email', async ({ request }) => {
    limitRate(request, 'change-email', 8, 3600000);
    const u = await requireUser(request);
    const data = validate(
      z.strictObject({ newEmail: emailSchema, password: z.string() }),
      await request.json(),
    );
    assert(
      !!u.passwordHash && (await Bun.password.verify(data.password, u.passwordHash)),
      403,
      'INVALID_PASSWORD',
      'Current password is incorrect',
    );
    assert(u.email !== data.newEmail, 422, 'VALIDATION_ERROR', 'Use a different email address');
    const taken = await prisma.user.findUnique({ where: { email: data.newEmail } });
    assert(!taken, 409, 'EMAIL_TAKEN', 'Email unavailable');
    const token = await issueToken(u.id, AUTH_TOKEN_PURPOSE.EMAIL_CHANGE, data.newEmail);
    const sent = await deliver(
      data.newEmail,
      'Confirm your new IssueTrack email',
      `${site()}/verify-email?mode=change&token=${encodeURIComponent(token)}`,
    );
    return { data: { message: 'Verification requested for new email', mailSent: sent } };
  })
  .post('/verify-email', async ({ request }) => {
    const u = await requireUser(request);
    const { token } = validate(z.strictObject({ token: z.string().min(20) }), await request.json());
    const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    assert(
      t &&
        t.userId === u.id &&
        t.purpose === AUTH_TOKEN_PURPOSE.EMAIL_CHANGE &&
        !t.usedAt &&
        t.expiresAt > new Date() &&
        t.pendingEmail,
      400,
      'INVALID_TOKEN',
      'Email change token is invalid or expired',
    );
    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.authToken.updateMany({
          where: { id: t.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        assert(claim.count === 1, 400, 'INVALID_TOKEN', 'Email change token already used');
        await tx.user.update({
          where: { id: u.id },
          data: { email: t.pendingEmail!, emailVerifiedAt: new Date() },
        });
      });
    } catch (e) {
      if (isUniqueError(e)) throw new AppError(409, 'EMAIL_TAKEN', 'Email is no longer available');
      throw e;
    }
    if (u.email) await deliver(u.email, 'Your IssueTrack email was changed', site());
    return { data: { message: 'Email updated' } };
  })
  .put('/avatar', async ({ request }) => {
    const u = await requireUser(request);
    const form = await request.formData();
    const file = form.get('file');
    assert(file instanceof File, 422, 'VALIDATION_ERROR', 'Select an image');
    const bytes = await normalizeImage(file, true),
      key = storageKey('avatar', u.id);
    await uploadObject(key, bytes);
    try {
      await prisma.user.update({ where: { id: u.id, deletedAt: null }, data: { avatarKey: key } });
    } catch (e) {
      await removeObject(key).catch(() => {});
      throw e;
    }
    if (u.avatarKey)
      await removeObject(u.avatarKey).catch((e) =>
        console.error('Avatar cleanup failed', String(e)),
      );
    return { data: { avatarUrl: `/api/v1/users/${u.username}/avatar` } };
  })
  .delete('/avatar', async ({ request }) => {
    const u = await requireUser(request);
    await prisma.user.update({ where: { id: u.id }, data: { avatarKey: null } });
    if (u.avatarKey)
      await removeObject(u.avatarKey).catch((e) =>
        console.error('Avatar cleanup failed', String(e)),
      );
    return new Response(null, { status: 204 });
  })
  .delete('/', async ({ request }) => {
    limitRate(request, 'delete-account', 5, 3600000);
    const u = await requireUser(request),
      data = validate(deleteAccountSchema, await request.json());
    assert(
      !!u.passwordHash && (await Bun.password.verify(data.password, u.passwordHash)),
      403,
      'INVALID_PASSWORD',
      'Current password is incorrect',
    );
    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        const locked = await lockUser(tx, u.id);
        assert(
          locked.passwordHash === u.passwordHash,
          409,
          'ACCOUNT_CHANGED',
          'Account credentials changed; try again',
        );
        const owned = await tx.issue.findMany({
          where: { authorId: u.id, deletedAt: null },
          select: { id: true },
        });
        const ids = owned.map((i) => i.id);
        if (ids.length) {
          await tx.issue.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
          await tx.issueActivity.updateMany({
            where: { issueId: { in: ids } },
            data: { auditExpiresAt: addDays(now, 365) },
          });
          await tx.notification.deleteMany({ where: { issueId: { in: ids } } });
        }
        await tx.comment.updateMany({
          where: { authorId: u.id, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.notification.deleteMany({ where: { recipientId: u.id } });
        await tx.notification.updateMany({ where: { actorId: u.id }, data: { actorId: null } });
        await tx.issueActivity.updateMany({ where: { actorId: u.id }, data: { actorId: null } });
        await tx.issue.updateMany({ where: { authorId: u.id }, data: { authorId: null } });
        await tx.comment.updateMany({ where: { authorId: u.id }, data: { authorId: null } });
        await tx.session.deleteMany({ where: { userId: u.id } });
        await tx.authToken.deleteMany({ where: { userId: u.id } });
        await tx.user.update({
          where: { id: u.id },
          data: {
            deletedAt: now,
            username: null,
            email: null,
            passwordHash: null,
            displayName: null,
            bio: null,
            githubUrl: null,
            avatarKey: null,
            emailVerifiedAt: null,
          },
        });
      },
      { timeout: 20000 },
    );
    if (u.avatarKey)
      await removeObject(u.avatarKey).catch((e) =>
        console.error('Deleted avatar cleanup failed', String(e)),
      );
    return logoutResponse();
  });
