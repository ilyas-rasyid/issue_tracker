import { Elysia } from 'elysia';
import { validate, loginSchema } from '../../../commons/validation/schemas';
import { safeUser } from '../../../commons/mappers/user.mapper';
import { requireUser, requireSession, makeSession } from '../../../security/session';
import { authResponse, logoutResponse, csrfResponse } from '../../../security/csrf';
import { limitRate } from '../../../security/rate-limit';
import { prisma } from '../../../infrastructure/database/prisma';
import { loginUser } from '../service/auth.service';

/** Auth session endpoints. */
export const authSessionRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .get('/csrf', () => csrfResponse())
  .post('/login', async ({ request }) => {
    limitRate(request, 'login', 25, 15 * 60000);
    const data = validate(loginSchema, await request.json());
    const user = await loginUser(data);
    return authResponse({ user: safeUser(user) }, await makeSession(user.id));
  })
  .get('/me', async ({ request }) => {
    const user = await requireUser(request);
    return { data: { ...safeUser(user), email: user.email, createdAt: user.createdAt } };
  })
  .post('/logout', async ({ request }) => {
    const session = await requireSession(request);
    await prisma.session.updateMany({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return logoutResponse();
  });
