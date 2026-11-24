import { Elysia } from 'elysia';
import { requireUser } from '../../../security/session';
import { deleteIssue } from '../service/issue-writer';

/** Issue deletion endpoint. */
export const issueDeleteRoutes = new Elysia({ prefix: '/api/v1/issues' }).delete(
  '/:key',
  async ({ params, request }) => {
    const user = await requireUser(request);
    await deleteIssue(user, params.key);
    return new Response(null, { status: 204 });
  },
);
