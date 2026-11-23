import { Elysia } from 'elysia';
import { randomUUID } from 'node:crypto';
import { AppError, problem, isUniqueError, isConflictError } from './lib/core';
import { enforceCsrf } from './lib/security';
import { authRoutes } from './features/auth/handler/auth.routes';
import { accountRoutes, publicUserRoutes } from './features/account/handler/account.index';
import { projectRoutes } from './features/projects/handler/projects.routes';
import { issueRoutes } from './features/issues/handler/issue.routes';
import { commentRoutes } from './features/comments/handler/comments.routes';
import { activityRoutes } from './features/activities/handler/activities.routes';
import { attachmentRoutes } from './features/attachments/handler/attachments.routes';
import { notificationRoutes } from './features/notifications/handler/notifications.routes';
if (process.env.NODE_ENV === 'production') {
  if (!process.env.APP_ORIGIN?.startsWith('https://'))
    throw Error('Production APP_ORIGIN must use HTTPS');
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw Error('Production SESSION_SECRET must be at least 32 chars');
  if (!process.env.USERNAME_HMAC_KEYS || process.env.USERNAME_HMAC_KEYS.includes('replace'))
    throw Error('Configure USERNAME_HMAC_KEYS');
}
const app = new Elysia()
  .onRequest(({ request }) => {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 7 * 1024 * 1024)
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request exceeds size limit');
    enforceCsrf(request);
  })
  .onAfterHandle(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['Cache-Control'] = 'no-store';
    set.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'";
  })
  .onError(({ error, request, set, code }) => {
    const requestId = randomUUID();
    const route = new URL(request.url).pathname;
    const isExpectedGuestAuthCheck =
      route === '/api/v1/auth/me' && error instanceof AppError && error.status === 401;
    if (!isExpectedGuestAuthCheck) {
      console.error(
        JSON.stringify({
          requestId,
          method: request.method,
          route,
          errorCode: code,
          error: String(error),
        }),
      );
    }
    let e: AppError;
    if (error instanceof AppError) e = error;
    else if (isUniqueError(error))
      e = new AppError(409, 'RESOURCE_CONFLICT', 'Resource already exists');
    else if (isConflictError(error))
      e = new AppError(409, 'CONCURRENT_MODIFICATION', 'Concurrent transaction conflict');
    else if (code === 'NOT_FOUND')
      e = new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
    else if (code === 'PARSE' || code === 'VALIDATION')
      e = new AppError(422, 'VALIDATION_ERROR', 'Request validation failed');
    else e = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please retry later');
    set.status = e.status;
    set.headers['Content-Type'] = 'application/problem+json';
    set.headers['Cache-Control'] = 'no-store';
    return problem(e, requestId);
  })
  .get('/api/v1/health', () => ({ data: { status: 'ok' } }))
  .use(authRoutes)
  .use(accountRoutes)
  .use(publicUserRoutes)
  .use(projectRoutes)
  .use(issueRoutes)
  .use(commentRoutes)
  .use(activityRoutes)
  .use(attachmentRoutes)
  .use(notificationRoutes);
app.listen(Number(process.env.PORT || 3001));
console.log(`IssueTrack API listening on :${process.env.PORT || 3001}`);
export type App = typeof app;
