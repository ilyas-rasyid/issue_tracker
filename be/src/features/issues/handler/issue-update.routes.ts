import { Elysia } from 'elysia';
import { validate, editIssueSchema } from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { updateIssue } from '../service/issue-writer';

/** Issue update endpoint. */
export const issueUpdateRoutes = new Elysia({ prefix: '/api/v1/issues' }).patch(
  '/:key',
  async ({ params, request }) => {
    const user = await requireUser(request);
    const data = validate(editIssueSchema, await request.json());
    const result = await updateIssue(user, params.key, data);
    return { data: result };
  },
);
