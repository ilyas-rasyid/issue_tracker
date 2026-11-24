import { Elysia } from 'elysia';
import {
  validate,
  createProjectSchema,
  editProjectSchema,
} from '../../../commons/validation/schemas';
import { requireUser } from '../../../security/session';
import { limitRate } from '../../../security/rate-limit';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../service/project.service';

/** Project endpoints. */
export const projectRoutes = new Elysia({ prefix: '/api/v1/projects' })
  .get('/', async () => {
    const data = await listProjects();
    return { data };
  })
  .post('/', async ({ request }) => {
    limitRate(request, 'create-project', 20, 3600000);
    const user = await requireUser(request, true);
    const data = validate(createProjectSchema, await request.json());
    const created = await createProject(user.id, data);
    return new Response(JSON.stringify({ data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  })
  .patch('/:slug', async ({ params, request }) => {
    await requireUser(request, true);
    const data = validate(editProjectSchema, await request.json());
    const updated = await updateProject(params.slug, data);
    return { data: updated };
  })
  .delete('/:slug', async ({ params, request }) => {
    await requireUser(request, true);
    await deleteProject(params.slug);
    return new Response(null, { status: 204 });
  });
