import { Elysia } from 'elysia';
import { accountProfileRoutes } from './account-profile.routes';
import { accountSecurityRoutes } from './account-security.routes';
import { accountDeletionRoutes } from './account-deletion.routes';
/** Compose focused endpoint groups; no business logic belongs in this index. */
export const accountRoutes = new Elysia()
  .use(accountProfileRoutes)
  .use(accountSecurityRoutes)
  .use(accountDeletionRoutes);
