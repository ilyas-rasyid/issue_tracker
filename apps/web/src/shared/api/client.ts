import { Activity } from './types';
export type APIErrorBody = {
  code?: string;
  detail?: string;
  errors?: {
    field: string;
    message: string;
  }[];
  requestId?: string;
  status?: number;
};
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors?: APIErrorBody['errors'],
  ) {
    super(message);
  }
}
export let csrfToken: string | null = null;
export async function csrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to initialize request security');
  csrfToken = (await response.json()).data.token;
  return csrfToken!;
}
export async function api<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    activity?: boolean;
  } = {},
): Promise<T> {
  const method = options.method || 'GET',
    headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await csrf();
    headers['X-User-Activity'] = '1';
    if (options.body instanceof FormData) body = options.body;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    let error: APIErrorBody = {};
    try {
      error = await res.json();
    } catch {}
    if (res.status === 403 && error.code === 'CSRF_REJECTED') csrfToken = null;
    throw new APIError(
      res.status,
      error.code || 'REQUEST_FAILED',
      error.detail || `Request failed (${res.status})`,
      error.errors,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
export const get = <T = any>(path: string) =>
  api<{
    data: T;
  }>(path).then((x) => x.data);
export const mutate = <T = any>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: any,
) =>
  api<{
    data: T;
  }>(path, { method, body }).then((x) => x?.data);
export const cleanPrivateSession = () => {
  csrfToken = null;
};
export function messageFor(e: unknown) {
  return e instanceof APIError ? e.message : e instanceof Error ? e.message : 'Unexpected error';
}
export function isApi(e: unknown, code: string) {
  return e instanceof APIError && e.code === code;
}
export const newRequestId = () => crypto.randomUUID();
