import { Elysia } from 'elysia';
import { issueCreateRoutes } from './issue-create.routes';
import { issueUpdateRoutes } from './issue-update.routes';
import { issueStatusRoutes } from './issue-status.routes';
import { issueDeleteRoutes } from './issue-delete.routes';
/** Compose focused endpoint groups; no business logic belongs in this index. */
export const issueWriteRoutes = new Elysia()
  .use(issueCreateRoutes)
  .use(issueUpdateRoutes)
  .use(issueStatusRoutes)
  .use(issueDeleteRoutes);
