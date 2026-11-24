import { Elysia } from 'elysia';
import { commentListRoutes } from './comment-list.routes';
import { commentCreateRoutes } from './comment-create.routes';
import { commentMutationRoutes } from './comment-mutation.routes';
/** Compose focused endpoint groups; no business logic belongs in this index. */
export const commentRoutes = new Elysia()
  .use(commentListRoutes)
  .use(commentCreateRoutes)
  .use(commentMutationRoutes);
