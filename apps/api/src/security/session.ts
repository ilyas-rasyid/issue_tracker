import { randomToken, sha256, AppError, addDays } from '../lib/core';
import { prisma } from '../infrastructure/database/prisma';
import { sessionCookie, cookieValue } from './csrf';
export async function makeSession(userId: string) {
  const token = randomToken(),
    now = new Date();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: addDays(now, 7),
      absoluteExpiresAt: addDays(now, 30),
      lastActivityAt: now,
    },
  });
  return token;
}
export async function getSession(req: Request) {
  const raw = cookieValue(req, sessionCookie);
  if (!raw) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  const now = new Date();
  if (!s || s.revokedAt || s.expiresAt <= now || s.absoluteExpiresAt <= now || s.user.deletedAt)
    return null;
  if (
    req.headers.get('x-user-activity') === '1' &&
    now.getTime() - s.lastActivityAt.getTime() > 3600000
  ) {
    const expires = new Date(Math.min(addDays(now, 7).getTime(), s.absoluteExpiresAt.getTime()));
    await prisma.session.updateMany({
      where: { id: s.id, revokedAt: null },
      data: { lastActivityAt: now, expiresAt: expires },
    });
  }
  return s;
}
export async function requireUser(req: Request, verified = false) {
  const s = await getSession(req);
  if (!s) throw new AppError(401, 'SESSION_EXPIRED', 'Your session is missing or has expired');
  if (verified && !s.user.emailVerifiedAt)
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Verify your email before creating public content',
    );
  return s.user;
}
export async function requireSession(req: Request) {
  const s = await getSession(req);
  if (!s) throw new AppError(401, 'SESSION_EXPIRED', 'Please log in again');
  return s;
}
