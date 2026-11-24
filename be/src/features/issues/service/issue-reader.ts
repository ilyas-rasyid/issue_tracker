import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert } from '../../../commons/errors/app-error';
import { ISSUE_STATUS } from '../../../commons/constants/domain.constants';
import { encodeCursor, decodeCursor } from '../../../commons/pagination/pagination';
import { sha256 } from '../../../commons/security/crypto';
import { issueDto } from './issue.mapper';
export const orderFromSort = (sort: string) => {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' as const };
    case 'updated':
      return { updatedAt: 'desc' as const };
    default:
      return { createdAt: 'desc' as const };
  }
};
export function whereFrom(url: URL, actorId?: string) {
  const p = url.searchParams;
  const where: any = { deletedAt: null };
  for (const [k, values] of [
    ['status', ISSUE_STATUS],
    ['type', { BUG: 'BUG', FEATURE: 'FEATURE', TASK: 'TASK' }],
    ['priority', { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' }],
  ] as const) {
    const v = p.get(k);
    if (v) {
      if (!Object.values(values).includes(v as any)) {
        throw new AppError(422, 'VALIDATION_ERROR', `Invalid ${k}`);
      }
      where[k] = v;
    }
  }
  const search = p.get('search')?.trim();
  if (search) {
    assert(search.length <= 100, 422, 'VALIDATION_ERROR', 'Search is too long');
    const n = /^ISS-(\d+)$/i.exec(search);
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      ...(n ? [{ issueNumber: Number(n[1]) }] : []),
    ];
  }
  const author = p.get('author');
  if (author) {
    where.author = { username: author.toLowerCase(), deletedAt: null };
  }
  const project = p.get('project')?.trim().toLowerCase();
  if (project) {
    where.project = { slug: project, deletedAt: null };
  }
  if (p.get('mine') === 'true') {
    assert(actorId, 401, 'UNAUTHORIZED', 'Please log in');
    where.authorId = actorId;
  }
  return where;
}
export const rankSQL = `CASE i."priority" WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END`;
export function priorityFilter(where: any) {
  const clauses = ['i."deletedAt" IS NULL'];
  const args: any[] = [];
  const param = (value: any, cast = '') => {
    args.push(value);
    return `$${args.length}${cast}`;
  };
  for (const f of ['status', 'type', 'priority'] as const) {
    if (where[f]) {
      clauses.push(`i."${f}" = ${param(where[f])}`);
    }
  }
  if (where.authorId) {
    clauses.push(`i."authorId" = ${param(where.authorId, '::uuid')}`);
  }
  if (where.author?.username) {
    clauses.push(
      `EXISTS(SELECT 1 FROM "User" u WHERE u.id=i."authorId" AND u.username=${param(where.author.username)} AND u."deletedAt" IS NULL)`,
    );
  }
  if (where.project?.slug) {
    clauses.push(
      `EXISTS(SELECT 1 FROM "Project" p WHERE p.id=i."projectId" AND p.slug=${param(where.project.slug)} AND p."deletedAt" IS NULL)`,
    );
  }
  if (where.OR?.length) {
    const search = String(where.OR[0].title.contains).replace(/[\\%_]/g, (c: string) => '\\' + c);
    const matching = [`i.title ILIKE ${param('%' + search + '%')} ESCAPE '\\'`];
    if (where.OR[1]?.issueNumber) {
      matching.push(`i."issueNumber" = ${param(where.OR[1].issueNumber)}`);
    }
    clauses.push(`(${matching.join(' OR ')})`);
  }
  return { clauses, args, param };
}
export async function priorityIDs(
  where: any,
  sort: string,
  limit: number,
  offset = 0,
  anchor?: {
    id: string;
    priority: string;
    createdAt: Date;
  },
) {
  const filter = priorityFilter(where);
  const dir = sort === 'priority_asc' ? 'ASC' : 'DESC';
  if (anchor) {
    const anchorRank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[
      anchor.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    ];
    const rank = filter.param(anchorRank);
    const date = filter.param(anchor.createdAt);
    const id = filter.param(anchor.id, '::uuid');
    filter.clauses.push(
      `(${rankSQL} ${dir === 'ASC' ? '>' : '<'} ${rank} OR ` +
        `(${rankSQL} = ${rank} AND ` +
        `(i."createdAt" < ${date} OR ` +
        `(i."createdAt" = ${date} AND i.id < ${id}))))`,
    );
  }
  const l = filter.param(limit);
  const o = filter.param(offset);
  const sql = [
    'SELECT i.id FROM "Issue" i',
    `WHERE ${filter.clauses.join(' AND ')}`,
    `ORDER BY ${rankSQL} ${dir}, i."createdAt" DESC, i.id DESC`,
    `LIMIT ${l} OFFSET ${o}`,
  ].join(' ');
  return prisma.$queryRawUnsafe<
    Array<{
      id: string;
    }>
  >(sql, ...filter.args);
}
export async function byIds(
  rows: {
    id: string;
  }[],
) {
  if (!rows.length) {
    return [];
  }
  const records = await prisma.issue.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: { author: true, project: true },
  });
  const map = new Map(records.map((i) => [i.id, i]));
  return rows.map((r) => map.get(r.id)!).filter(Boolean);
}
export async function listPage(where: any, sort: string, page: number, limit: number) {
  if (!['priority_asc', 'priority_desc'].includes(sort)) {
    return prisma.issue.findMany({
      where,
      include: { author: true, project: true },
      orderBy: [orderFromSort(sort), { id: 'desc' as const }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
  return byIds(await priorityIDs(where, sort, limit, (page - 1) * limit));
}
export const boardScope = (url: URL, status: string) => {
  const relevant = [...url.searchParams]
    .filter(([k]) => !k.startsWith('cursor') && k !== 'view' && k !== 'page' && k !== 'limit')
    .sort(([a], [b]) => a.localeCompare(b));
  return `board:${status}:${sha256(JSON.stringify(relevant))}`;
};
export async function columnPage(
  where: any,
  sort: string,
  token: string | undefined,
  scope: string,
) {
  const cursor = decodeCursor(token, scope);
  let rows: any[] = [];
  if (['priority_asc', 'priority_desc'].includes(sort)) {
    const anchor = cursor
      ? await prisma.issue.findFirst({ where: { id: cursor.id, ...where } })
      : undefined;
    if (cursor) {
      assert(anchor, 400, 'INVALID_CURSOR', 'Board cursor is no longer valid');
    }
    rows = await byIds(await priorityIDs(where, sort, 11, 0, anchor ?? undefined));
  } else {
    const field = sort === 'updated' ? 'updatedAt' : 'createdAt';
    const dir = sort === 'oldest' ? 'asc' : 'desc';
    const op = dir === 'asc' ? 'gt' : 'lt';
    const cursorFilter = cursor
      ? {
          OR: [
            { [field]: { [op]: cursor.date } },
            { [field]: cursor.date, id: { [op]: cursor.id } },
          ],
        }
      : {};
    rows = await prisma.issue.findMany({
      where: cursor ? { AND: [where, cursorFilter] } : where,
      include: { author: true, project: true },
      orderBy: [{ [field]: dir }, { id: dir }],
      take: 11,
    });
  }
  const more = rows.length > 10;
  const visible = rows.slice(0, 10);
  const last = visible.at(-1);
  return {
    data: visible.map((v) => issueDto(v)),
    hasMore: more,
    nextCursor:
      more && last
        ? encodeCursor(sort === 'updated' ? last.updatedAt : last.createdAt, last.id, scope)
        : null,
  };
}
