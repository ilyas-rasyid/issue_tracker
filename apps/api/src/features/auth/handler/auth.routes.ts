import { Elysia } from 'elysia';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  AppError,
  assert,
  validate,
  registerSchema,
  loginSchema,
  emailSchema,
  passwordSchema,
  AUTH_TOKEN_PURPOSE,
  sha256,
  randomToken,
  usernameKeys,
  liveUsernameKey,
  safeUser,
  isUniqueError,
} from '../../../lib/core';
import {
  requireUser,
  requireSession,
  makeSession,
  authResponse,
  logoutResponse,
  csrfResponse,
  limitRate,
} from '../../../lib/security';
import { issueToken, deliver } from '../service/auth-token.service';
export const site = () => process.env.APP_ORIGIN || 'http://localhost:5173';
export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .get('/csrf', () => csrfResponse())
  .post('/register', async ({ request }) => {
    limitRate(request, 'register', 10, 3600000);
    const data = validate(registerSchema, await request.json());
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
      if (isUniqueError(e))
        throw new AppError(409, 'ACCOUNT_UNAVAILABLE', 'Username or email is unavailable');
      throw e;
    }
    const token = await issueToken(user.id, AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION);
    const mailSent = await deliver(
      data.email,
      'Verify your IssueTrack email',
      `${site()}/verify-email?token=${encodeURIComponent(token)}`,
    );
    const session = await makeSession(user.id);
    return authResponse(
      { user: safeUser(user), authenticated: true, nextAction: 'VERIFY_EMAIL', mailSent },
      session,
      201,
    );
  })
  .post('/login', async ({ request }) => {
    limitRate(request, 'login', 25, 15 * 60000);
    const { email, password } = validate(loginSchema, await request.json());
    const u = await prisma.user.findUnique({ where: { email } });
    if (
      !u ||
      u.deletedAt ||
      !u.passwordHash ||
      !(await Bun.password.verify(password, u.passwordHash))
    )
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    return authResponse({ user: safeUser(u) }, await makeSession(u.id));
  })
  .get('/me', async ({ request }) => {
    const u = await requireUser(request);
    return { data: { ...safeUser(u), email: u.email, createdAt: u.createdAt } };
  })
  .post('/logout', async ({ request }) => {
    const s = await requireSession(request);
    await prisma.session.updateMany({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return logoutResponse();
  })
  .post('/resend-verification', async ({ request }) => {
    limitRate(request, 'resend', 5, 3600000);
    const u = await requireUser(request);
    if (u.emailVerifiedAt) return { data: { message: 'Email already verified' } };
    assert(!!u.email, 409, 'ACCOUNT_UNAVAILABLE', 'Email unavailable');
    const last = await prisma.authToken.findFirst({
      where: { userId: u.id, purpose: AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION },
      orderBy: { createdAt: 'desc' },
    });
    assert(
      !last || Date.now() - last.createdAt.getTime() >= 60000,
      429,
      'RATE_LIMITED',
      'Please wait before requesting another email',
    );
    const token = await issueToken(u.id, AUTH_TOKEN_PURPOSE.EMAIL_VERIFICATION);
    const sent = await deliver(
      u.email,
      'Verify your IssueTrack email',
      `${site()}/verify-email?token=${encodeURIComponent(token)}`,
    );
    return {
      data: {
        message: sent
          ? 'Verification email requested'
          : 'Email delivery unavailable; please retry later',
        mailSent: sent,
      },
    };
  })
  .post('/verify-email', async ({ request }) => {
    limitRate(request, 'verify', 20, 3600000);
    const { token } = validate(z.strictObject({ token: z.string().min(20) }), await request.json());
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
    return { data: { verified: true } };
  })
  .post('/forgot-password', async ({ request }) => {
    limitRate(request, 'forgot-password', 6, 3600000);
    const { email } = validate(z.strictObject({ email: emailSchema }), await request.json());
    const u = await prisma.user.findUnique({ where: { email } });
    if (u && !u.deletedAt) {
      const token = await issueToken(u.id, AUTH_TOKEN_PURPOSE.PASSWORD_RESET);
      await deliver(
        email,
        'Reset your IssueTrack password',
        `${site()}/reset-password?token=${encodeURIComponent(token)}`,
      );
    }
    return { data: { message: 'If this email is registered, a reset link has been requested.' } };
  })
  .post('/reset-password', async ({ request }) => {
    limitRate(request, 'reset', 10, 3600000);
    const { token, newPassword } = validate(
      z.strictObject({ token: z.string().min(20), newPassword: passwordSchema }),
      await request.json(),
    );
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
    return { data: { message: 'Password reset. Please log in again.' } };
  });
