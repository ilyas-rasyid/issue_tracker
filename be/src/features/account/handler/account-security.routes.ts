import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, passwordSchema, emailSchema } from '../../../commons/validation/schemas';
import { requireUser, requireSession, makeSession } from '../../../security/session';
import { authResponse } from '../../../security/csrf';
import { limitRate } from '../../../security/rate-limit';
import { changePassword, requestEmailChange, verifyEmailChange } from '../service/account.service';

/** Account security (password and email change) endpoints. */
export const accountSecurityRoutes = new Elysia({ prefix: '/api/v1/account' })
  .post('/change-password', async ({ request }) => {
    limitRate(request, 'change-password', 10, 3600000);
    const session = await requireSession(request);
    const data = validate(
      z.strictObject({ currentPassword: z.string(), newPassword: passwordSchema }),
      await request.json(),
    );
    await changePassword(session, data.currentPassword, data.newPassword);
    return authResponse({ message: 'Password changed' }, await makeSession(session.user.id));
  })
  .post('/change-email', async ({ request }) => {
    limitRate(request, 'change-email', 8, 3600000);
    const user = await requireUser(request);
    const data = validate(
      z.strictObject({ newEmail: emailSchema, password: z.string() }),
      await request.json(),
    );
    const result = await requestEmailChange(user, data.newEmail, data.password);
    return {
      data: {
        message: 'Verification requested for new email',
        mailSent: result.mailSent,
      },
    };
  })
  .post('/verify-email', async ({ request }) => {
    const user = await requireUser(request);
    const { token } = validate(z.strictObject({ token: z.string().min(20) }), await request.json());
    await verifyEmailChange(user, token);
    return { data: { message: 'Email updated' } };
  });
