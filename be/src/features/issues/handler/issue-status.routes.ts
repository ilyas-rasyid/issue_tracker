import { Elysia } from 'elysia';
import { validate, statusSchema } from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { changeIssueStatus } from '../service/issue-writer';

/** Issue status transition endpoint. */
export const issueStatusRoutes = new Elysia({ prefix: '/api/v1/issues' }).patch(
  '/:key/status',
  async ({ params, request }) => {
    const user = await requireUser(request);
    const data = validate(statusSchema, await request.json());
    const result = await changeIssueStatus(user, params.key, data);
    return { data: result };
  },
);
