import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, emailSchema, passwordSchema } from '../../../commons/validation/schemas';
import { limitRate } from '../../../security/rate-limit';
import { requestPasswordReset, resetUserPassword } from '../service/auth.service';

/** Auth password recovery endpoints. */
export const authPasswordRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post('/forgot-password', async ({ request }) => {
    limitRate(request, 'forgot-password', 6, 3600000);
    const { email } = validate(z.strictObject({ email: emailSchema }), await request.json());
    await requestPasswordReset(email);
    return { data: { message: 'If this email is registered, a reset link has been requested.' } };
  })
  .post('/reset-password', async ({ request }) => {
    limitRate(request, 'reset', 10, 3600000);
    const { token, newPassword } = validate(
      z.strictObject({ token: z.string().min(20), newPassword: passwordSchema }),
      await request.json(),
    );
    await resetUserPassword(token, newPassword);
    return { data: { message: 'Password reset. Please log in again.' } };
  });
