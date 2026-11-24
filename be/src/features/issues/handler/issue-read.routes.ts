import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import { assert } from '../../../commons/errors/app-error';
import { parseIssueKey } from '../../../commons/utils/issue-key';
import { ISSUE_STATUS } from '../../../commons/constants/domain.constants';
import { pageParams } from '../../../commons/pagination/pagination';
import { getSession } from '../../../security/session';
import { whereFrom, listPage, boardScope, columnPage } from '../service/issue-reader';
import { issueDto } from '../service/issue.mapper';
export const issueReadRoutes = new Elysia({ prefix: '/api/v1/issues' })
  .get('/', async ({ request }) => {
    const url = new URL(request.url);
    const { page, limit } = pageParams(url);
    const sort = url.searchParams.get('sort') || 'newest';
    assert(
      ['newest', 'oldest', 'updated', 'priority_desc', 'priority_asc'].includes(sort),
      422,
      'VALIDATION_ERROR',
      'Invalid sort',
    );
    const session = await getSession(request);
    const where = whereFrom(url, session?.user.id);
    const [data, total] = await Promise.all([
      listPage(where, sort, page, limit),
      prisma.issue.count({ where }),
    ]);
    return {
      data: data.map((v) => issueDto(v)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  })
  .get('/board', async ({ request }) => {
    const url = new URL(request.url);
    const session = await getSession(request);
    const base = whereFrom(url, session?.user.id);
    const sort = url.searchParams.get('sort') || 'newest';
    assert(
      ['newest', 'oldest', 'updated', 'priority_desc', 'priority_asc'].includes(sort),
      422,
      'VALIDATION_ERROR',
      'Invalid sort',
    );
    const columns: any = {};
    for (const status of Object.values(ISSUE_STATUS)) {
      const where = { ...base, status };
      const count = await prisma.issue.count({ where });
      const page = await columnPage(
        where,
        sort,
        url.searchParams.get(`cursor${status}`) || undefined,
        boardScope(url, status),
      );
      columns[status] = { ...page, total: count };
    }
    return { data: { columns } };
  })
  .get('/:key', async ({ params }) => {
    const issue = await prisma.issue.findUnique({
      where: { issueNumber: parseIssueKey(params.key) },
      include: {
        author: true,
        project: true,
        attachments: true,
        _count: {
          select: { comments: { where: { deletedAt: null, author: { is: { deletedAt: null } } } } },
        },
      },
    });
    assert(issue && !issue.deletedAt, 404, 'ISSUE_NOT_FOUND', 'Issue not found');
    return { data: issueDto(issue, true) };
  });
