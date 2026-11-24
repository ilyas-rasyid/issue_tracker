import { AppError } from './app-error';
export const problem = (error: AppError, requestId: string) => ({
  type: 'about:blank',
  title:
    error.status === 422
      ? 'Validation failed'
      : error.status === 409
        ? 'Conflict'
        : error.status === 404
          ? 'Not Found'
          : error.status === 403
            ? 'Forbidden'
            : error.status === 401
              ? 'Unauthorized'
              : error.status >= 500
                ? 'Server Error'
                : 'Request failed',
  status: error.status,
  detail: error.message,
  code: error.code,
  requestId,
  ...(error.errors ? { errors: error.errors } : {}),
});
