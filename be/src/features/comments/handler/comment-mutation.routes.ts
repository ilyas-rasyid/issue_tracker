import { Elysia } from 'elysia';
import { validate, editCommentSchema } from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { updateComment, deleteComment } from '../service/comment.service';

/** Comment update and delete endpoints. */
export const commentMutationRoutes = new Elysia({ prefix: '/api/v1' })
  .patch('/comments/:id', async ({ params, request }) => {
    const user = await requireUser(request);
    const data = validate(editCommentSchema, await request.json());
    const result = await updateComment(user, params.id, data);
    return { data: result };
  })
  .delete('/comments/:id', async ({ params, request }) => {
    const user = await requireUser(request);
    await deleteComment(user, params.id);
    return new Response(null, { status: 204 });
  });
