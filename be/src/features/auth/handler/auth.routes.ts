import { Elysia } from 'elysia';
import { authRegistrationRoutes } from './auth-registration.routes';
import { authSessionRoutes } from './auth-session.routes';
import { authPasswordRoutes } from './auth-password.routes';
/** Compose focused endpoint groups; no business logic belongs in this index. */
export const authRoutes = new Elysia()
  .use(authRegistrationRoutes)
  .use(authSessionRoutes)
  .use(authPasswordRoutes);
