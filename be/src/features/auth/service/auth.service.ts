import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert, isUniqueError } from '../../../commons/errors/app-error';
import { type LoginInput, type RegisterInput } from '../../../commons/validation/schemas';
import { AUTH_TOKEN_PURPOSE } from '../../../commons/constants/domain.constants';
import { sha256, usernameKeys, liveUsernameKey } from '../../../commons/security/crypto';
import { safeUser } from '../../../commons/mappers/user.mapper';
import { issueToken, deliver } from './auth-token.service';

const site = () => process.env.APP_ORIGIN || 'http://localhost:5173';

export async function loginUser(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (
    !user ||
    user.deletedAt ||
    !user.passwordHash ||
    !(await Bun.password.verify(data.password, user.passwordHash))
  ) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return user;
}

export async function registerUser(data: RegisterInput) {
  const keys = usernameKeys(data.username);
  const exists = await prisma.user.findFirst({
    where: { usernameKey: { in: keys } },
    select: { id: true },
  });
  assert(!exists, 409, 'USERNAME_UNAVAILABLE', 'Please choose another username');
  const passwordHash = await Bun.password.hash(data.password, { algorithm: 'argon2id' });
  let user;
  try {
    user = await prisma.user.create({
      data: {
        username: data.username,
        usernameKey: liveUsernameKey(data.username),
        displayName: data.displayName,
        email: data.email,
        passwordHash,
      },
    });
  } catch (e) {
    if (isUniqueError(e)) {
      throw new AppError(409, 'ACCOUNT_UNAVAILABLE', 'Username or email is unavailable');
    }
    throw e;
  }
  const token = await issueToken(user.id, AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  const mailSent = await deliver(
    data.email,
    'Verify your IssueTrack email',
    `${site()}/verify-email?token=${encodeURIComponent(token)}`,
  );
  return { user, mailSent };
}

export async function resendEmailVerification(user: {
  id: string;
  email: string | null;
  emailVerifiedAt: Date | null;
}) {
  if (user.emailVerifiedAt) {
    return { alreadyVerified: true, mailSent: false };
  }
  assert(!!user.email, 409, 'ACCOUNT_UNAVAILABLE', 'Email unavailable');
  const last = await prisma.authToken.findFirst({
    where: { userId: user.id, purpose: AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION },
    orderBy: { createdAt: 'desc' },
  });
  assert(
    !last || Date.now() - last.createdAt.getTime() >= 60000,
    429,
    'RATE_LIMITED',
    'Please wait before requesting another email',
  );
  const token = await issueToken(user.id, AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION);
  const sent = await deliver(
    user.email,
    'Verify your IssueTrack email',
    `${site()}/verify-email?token=${encodeURIComponent(token)}`,
  );
  return { alreadyVerified: false, mailSent: sent };
}

export async function verifyUserEmail(token: string) {
  const t = await prisma.authToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  assert(
    t &&
      t.purpose === AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION &&
      !t.usedAt &&
      t.expiresAt > new Date() &&
      !t.user.deletedAt,
    400,
    'INVALID_TOKEN',
    'This verification link is invalid or expired',
  );
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: t.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    assert(claimed.count === 1, 400, 'INVALID_TOKEN', 'This verification link was already used');
    await tx.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.authToken.deleteMany({
      where: {
        userId: t.userId,
        purpose: AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION,
        id: { not: t.id },
      },
    });
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const token = await issueToken(user.id, AUTH_TOKEN_PURPOSE.PASSWORD_RESET);
    await deliver(
      email,
      'Reset your IssueTrack password',
      `${site()}/reset-password?token=${encodeURIComponent(token)}`,
    );
  }
}

export async function resetUserPassword(token: string, newPassword: string) {
  const t = await prisma.authToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  assert(
    t &&
      t.purpose === AUTH_TOKEN_PURPOSE.PASSWORD_RESET &&
      !t.usedAt &&
      t.expiresAt > new Date() &&
      !t.user.deletedAt,
    400,
    'INVALID_TOKEN',
    'This reset link is invalid or expired',
  );
  const hash = await Bun.password.hash(newPassword, { algorithm: 'argon2id' });
  await prisma.$transaction(async (tx) => {
    const claim = await tx.authToken.updateMany({
      where: { id: t.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    assert(claim.count === 1, 400, 'INVALID_TOKEN', 'This reset link was already used');
    await tx.user.update({ where: { id: t.userId }, data: { passwordHash: hash } });
    await tx.session.deleteMany({ where: { userId: t.userId } });
    await tx.authToken.deleteMany({ where: { userId: t.userId, id: { not: t.id } } });
  });
}
