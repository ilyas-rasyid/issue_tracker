import { Elysia } from 'elysia';
import { validate, profileSchema } from '../../../commons/validation/schemas';
import { assert } from '../../../commons/errors/app-error';
import { requireUser } from '../../../security/session';
import { updateProfile, updateAvatar, deleteAvatar } from '../service/account.service';

/** Account profile and avatar endpoints. */
export const accountProfileRoutes = new Elysia({ prefix: '/api/v1/account' })
  .patch('/profile', async ({ request }) => {
    const user = await requireUser(request);
    const data = validate(profileSchema, await request.json());
    const profile = await updateProfile(user.id, data);
    return { data: profile };
  })
  .put('/avatar', async ({ request }) => {
    const user = await requireUser(request);
    const form = await request.formData();
    const file = form.get('file');
    assert(file instanceof File, 422, 'VALIDATION_ERROR', 'Select an image');
    const data = await updateAvatar(user, file);
    return { data };
  })
  .delete('/avatar', async ({ request }) => {
    const user = await requireUser(request);
    await deleteAvatar(user);
    return new Response(null, { status: 204 });
  });
