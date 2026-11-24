import { prisma } from '../../../infrastructure/database/prisma';
import { AppError, assert, isUniqueError } from '../../../commons/errors/app-error';
import {
  type CreateProjectInput,
  type EditProjectInput,
} from '../../../commons/validation/schemas';
import { actorDto } from '../../../commons/mappers/user.mapper';

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base.length >= 2 ? base : `project-${Date.now().toString(36)}`;
}

export function projectDto(p: any) {
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

export async function listProjects() {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    include: {
      owner: true,
      _count: { select: { issues: { where: { deletedAt: null } } } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return projects.map(projectDto);
}

export async function createProject(userId: string, data: CreateProjectInput) {
  const slug = data.slug || slugify(data.name);
  try {
    const created = await prisma.project.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        ownerId: userId,
      },
      include: {
        owner: true,
        _count: { select: { issues: { where: { deletedAt: null } } } },
      },
    });
    return projectDto(created);
  } catch (e) {
    if (isUniqueError(e)) {
      throw new AppError(409, 'PROJECT_SLUG_TAKEN', 'A project with this slug already exists');
    }
    throw e;
  }
}

export async function updateProject(slug: string, data: EditProjectInput) {
  const project = await prisma.project.findFirst({
    where: { slug: slug.toLowerCase(), deletedAt: null },
  });
  assert(project, 404, 'PROJECT_NOT_FOUND', 'Project not found');
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
  return projectDto(updated);
}

export async function deleteProject(slug: string) {
  const project = await prisma.project.findFirst({
    where: { slug: slug.toLowerCase(), deletedAt: null },
  });
  assert(project, 404, 'PROJECT_NOT_FOUND', 'Project not found');
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
}
