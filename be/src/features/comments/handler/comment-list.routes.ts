import { Elysia } from 'elysia';
import { listComments } from '../service/comment.service';

/** Comment list endpoint. */
export const commentListRoutes = new Elysia({ prefix: '/api/v1' }).get(
  '/issues/:key/comments',
  async ({ params, request }) => {
    return listComments(params.key, new URL(request.url));
  },
);
