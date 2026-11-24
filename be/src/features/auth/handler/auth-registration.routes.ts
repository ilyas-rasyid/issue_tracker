import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, registerSchema } from '../../../commons/validation/schemas';
import { safeUser } from '../../../commons/mappers/user.mapper';
import { requireUser, makeSession } from '../../../security/session';
import { authResponse } from '../../../security/csrf';
import { limitRate } from '../../../security/rate-limit';
import { registerUser, resendEmailVerification, verifyUserEmail } from '../service/auth.service';

/** Auth registration and email verification endpoints. */
export const authRegistrationRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post('/register', async ({ request }) => {
    limitRate(request, 'register', 10, 3600000);
    const data = validate(registerSchema, await request.json());
    const { user, mailSent } = await registerUser(data);
    const session = await makeSession(user.id);
    return authResponse(
      { user: safeUser(user), authenticated: true, nextAction: 'VERIFY_EMAIL', mailSent },
      session,
      201,
    );
  })
  .post('/resend-verification', async ({ request }) => {
    limitRate(request, 'resend', 5, 3600000);
    const user = await requireUser(request);
    const result = await resendEmailVerification(user);
    if (result.alreadyVerified) {
      return { data: { message: 'Email already verified' } };
    }
    return {
      data: {
        message: result.mailSent
          ? 'Verification email requested'
          : 'Email delivery unavailable; please retry later',
        mailSent: result.mailSent,
      },
    };
  })
  .post('/verify-email', async ({ request }) => {
    limitRate(request, 'verify', 20, 3600000);
    const { token } = validate(z.strictObject({ token: z.string().min(20) }), await request.json());
    await verifyUserEmail(token);
    return { data: { verified: true } };
  });
