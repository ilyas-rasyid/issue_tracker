import { Elysia } from 'elysia';
import { validate, createIssueSchema } from '../../../commons/validation/schemas';
import { issueKey } from '../../../commons/utils/issue-key';
import { requireUser } from '../../../security/session';
import { limitRate } from '../../../security/rate-limit';
import { issueDto } from '../service/issue.mapper';
import { createIssue } from '../service/issue-writer';

/** Issue create endpoint. */
export const issueCreateRoutes = new Elysia({ prefix: '/api/v1/issues' }).post(
  '/',
  async ({ request }) => {
    limitRate(request, 'create-issue', 40, 3600000);
    const user = await requireUser(request, true);
    const data = validate(createIssueSchema, await request.json());

    const result = await createIssue(user, data);

    if (result.isReplay) {
      return new Response(JSON.stringify({ data: issueDto(result.issue, true) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: issueDto(result.issue, true) }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        Location: `/api/v1/issues/${issueKey(result.issue.issueNumber)}`,
      },
    });
  },
);
