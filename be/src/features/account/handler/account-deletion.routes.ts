import { Elysia } from 'elysia';
import { validate, deleteAccountSchema } from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { logoutResponse } from '../../../security/csrf';
import { limitRate } from '../../../security/rate-limit';
import { deleteUserAccount } from '../service/account.service';

/** Account deletion endpoint. */
export const accountDeletionRoutes = new Elysia({ prefix: '/api/v1/account' }).delete(
  '/',
  async ({ request }) => {
    limitRate(request, 'delete-account', 5, 3600000);
    const user = await requireUser(request);
    const data = validate(deleteAccountSchema, await request.json());
    await deleteUserAccount(user, data);
    return logoutResponse();
  },
);
