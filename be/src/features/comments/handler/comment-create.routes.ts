import { Elysia } from 'elysia';
import { validate, commentSchema } from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { limitRate } from '../../../security/rate-limit';
import { createComment } from '../service/comment.service';
import { commentDto } from '../service/comment.mapper';

/** Comment creation endpoint. */
export const commentCreateRoutes = new Elysia({ prefix: '/api/v1' }).post(
  '/issues/:key/comments',
  async ({ params, request }) => {
    limitRate(request, 'create-comment', 100, 3600000);
    const user = await requireUser(request, true);
    const data = validate(commentSchema, await request.json());

    const result = await createComment(user, params.key, data);

    if (result.isReplay) {
      return new Response(JSON.stringify({ data: commentDto(result.comment) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: commentDto(result.comment) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  },
);
