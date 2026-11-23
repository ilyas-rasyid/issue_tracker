import { Elysia } from 'elysia';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  AppError,
  assert,
  validate,
  createProjectSchema,
  editProjectSchema,
  actorDto,
  isUniqueError,
} from '../../../lib/core';
import { requireUser, limitRate } from '../../../lib/security';

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base.length >= 2 ? base : `project-${Date.now().toString(36)}`;
}

function projectDto(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    owner: actorDto(p.owner),
    issueCount: p._count?.issues ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const projectRoutes = new Elysia({ prefix: '/api/v1/projects' })
  .get('/', async () => {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        owner: true,
        _count: { select: { issues: { where: { deletedAt: null } } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { data: projects.map(projectDto) };
  })
  .post('/', async ({ request }) => {
    limitRate(request, 'create-project', 20, 3600000);
    const user = await requireUser(request, true);
    const data = validate(createProjectSchema, await request.json());
    const slug = data.slug || slugify(data.name);

    let created;
    try {
      created = await prisma.project.create({
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          ownerId: user.id,
        },
        include: {
          owner: true,
          _count: { select: { issues: { where: { deletedAt: null } } } },
        },
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new AppError(409, 'PROJECT_SLUG_TAKEN', 'A project with this slug already exists');
      }
      throw e;
    }

    return new Response(JSON.stringify({ data: projectDto(created) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  })
  .patch('/:slug', async ({ params, request }) => {
    const user = await requireUser(request);
    const data = validate(editProjectSchema, await request.json());
    const project = await prisma.project.findFirst({
      where: { slug: params.slug.toLowerCase(), deletedAt: null },
    });
    assert(project, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    assert(
      project.ownerId === user.id,
      403,
      'NOT_PROJECT_OWNER',
      'Only the project owner can edit',
    );

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      include: {
        owner: true,
        _count: { select: { issues: { where: { deletedAt: null } } } },
      },
    });
    return { data: projectDto(updated) };
  })
  .delete('/:slug', async ({ params, request }) => {
    const user = await requireUser(request);
    const project = await prisma.project.findFirst({
      where: { slug: params.slug.toLowerCase(), deletedAt: null },
    });
    assert(project, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    assert(
      project.ownerId === user.id,
      403,
      'NOT_PROJECT_OWNER',
      'Only the project owner can delete',
    );
    await prisma.$transaction(async (tx) => {
      await tx.issue.updateMany({
        where: { projectId: project.id },
        data: { projectId: null },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { deletedAt: new Date() },
      });
    });
    return new Response(null, { status: 204 });
  });
