import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert, isUniqueError } from '../../../commons/errors/app-error';
import { addDays } from '../../../commons/utils/dates';
import { type ProfileInput, type DeleteAccountInput } from '../../../commons/validation/schemas';
import { AUTH_TOKEN_PURPOSE } from '../../../commons/constants/domain.constants';
import { sha256 } from '../../../commons/security/crypto';
import { lockUser } from '../../../infrastructure/database/locks';
import { normalizeImage } from '../../../infrastructure/storage/image-processing';
import {
  uploadObject,
  removeObject,
  storageKey,
} from '../../../infrastructure/storage/object-storage';
import { issueToken, deliver } from '../../auth/service/auth-token.service';

const site = () => process.env.APP_ORIGIN || 'http://localhost:5173';

export async function updateProfile(userId: string, data: ProfileInput) {
  assert(Object.keys(data).length > 0, 422, 'VALIDATION_ERROR', 'At least one field is required');
  const next = await prisma.user.update({ where: { id: userId }, data });
  return {
    username: next.username,
    displayName: next.displayName,
    bio: next.bio,
    githubUrl: next.githubUrl,
    avatarUrl: next.avatarKey ? `/api/v1/users/${next.username}/avatar` : null,
    updatedAt: next.updatedAt,
  };
}

export async function updateAvatar(
  user: { id: string; username: string | null; avatarKey: string | null },
  file: File,
) {
  const bytes = await normalizeImage(file, true);
  const key = storageKey('avatar', user.id);
  await uploadObject(key, bytes);
  try {
    await prisma.user.update({ where: { id: user.id, deletedAt: null }, data: { avatarKey: key } });
  } catch (e) {
    await removeObject(key).catch(() => {
      // Best-effort cleanup
    });
    throw e;
  }
  if (user.avatarKey) {
    await removeObject(user.avatarKey).catch((e) =>
      console.error('Avatar cleanup failed', String(e)),
    );
  }
  return { avatarUrl: `/api/v1/users/${user.username}/avatar` };
}

export async function deleteAvatar(user: { id: string; avatarKey: string | null }) {
  await prisma.user.update({ where: { id: user.id }, data: { avatarKey: null } });
  if (user.avatarKey) {
    await removeObject(user.avatarKey).catch((e) =>
      console.error('Avatar cleanup failed', String(e)),
    );
  }
}

export async function changePassword(
  session: { id: string; user: { id: string; passwordHash: string | null } },
  currentPassword: string,
  newPassword: string,
) {
  assert(
    !!session.user.passwordHash &&
      (await Bun.password.verify(currentPassword, session.user.passwordHash)),
    403,
    'INVALID_PASSWORD',
    'Current password is incorrect',
  );
  const hash = await Bun.password.hash(newPassword, { algorithm: 'argon2id' });
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, session.user.id);
    await tx.user.update({ where: { id: session.user.id }, data: { passwordHash: hash } });
    await tx.session.deleteMany({ where: { userId: session.user.id, id: { not: session.id } } });
    await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  });
}

export async function requestEmailChange(
  user: { id: string; email: string | null; passwordHash: string | null },
  newEmail: string,
  password: string,
) {
  assert(
    !!user.passwordHash && (await Bun.password.verify(password, user.passwordHash)),
    403,
    'INVALID_PASSWORD',
    'Current password is incorrect',
  );
  assert(user.email !== newEmail, 422, 'VALIDATION_ERROR', 'Use a different email address');
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  assert(!taken, 409, 'EMAIL_TAKEN', 'Email unavailable');
  const token = await issueToken(user.id, AUTH_TOKEN_PURPOSE.EMAIL_CHANGE, newEmail);
  const sent = await deliver(
    newEmail,
    'Confirm your new IssueTrack email',
    `${site()}/verify-email?mode=change&token=${encodeURIComponent(token)}`,
  );
  return { mailSent: sent };
}

export async function verifyEmailChange(user: { id: string; email: string | null }, token: string) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  assert(
    t &&
      t.userId === user.id &&
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
        where: { id: user.id },
        data: { email: t.pendingEmail!, emailVerifiedAt: new Date() },
      });
    });
  } catch (e) {
    if (isUniqueError(e)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is no longer available');
    }
    throw e;
  }
  if (user.email) {
    await deliver(user.email, 'Your IssueTrack email was changed', site());
  }
}

export async function deleteUserAccount(
  user: { id: string; passwordHash: string | null; avatarKey: string | null },
  data: DeleteAccountInput,
) {
  assert(
    !!user.passwordHash && (await Bun.password.verify(data.password, user.passwordHash)),
    403,
    'INVALID_PASSWORD',
    'Current password is incorrect',
  );
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      const locked = await lockUser(tx, user.id);
      assert(
        locked.passwordHash === user.passwordHash,
        409,
        'ACCOUNT_CHANGED',
        'Account credentials changed; try again',
      );
      const owned = await tx.issue.findMany({
        where: { authorId: user.id, deletedAt: null },
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
        where: { authorId: user.id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.notification.deleteMany({ where: { recipientId: user.id } });
      await tx.notification.updateMany({ where: { actorId: user.id }, data: { actorId: null } });
      await tx.issueActivity.updateMany({ where: { actorId: user.id }, data: { actorId: null } });
      await tx.issue.updateMany({ where: { authorId: user.id }, data: { authorId: null } });
      await tx.comment.updateMany({ where: { authorId: user.id }, data: { authorId: null } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.authToken.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
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
  if (user.avatarKey) {
    await removeObject(user.avatarKey).catch((e) =>
      console.error('Deleted avatar cleanup failed', String(e)),
    );
  }
}
