import { hmac, randomToken, secureEqual, assert } from '../lib/core';
export const prod = process.env.NODE_ENV === 'production';
export const sessionCookie = prod ? '__Host-session' : 'tracker-session';
export const csrfCookie = prod ? '__Host-tracker-csrf' : 'tracker-csrf';
export const cookieValue = (req: Request, name: string) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1) || '';
export function cookieHeader(name: string, value: string, maxAge: number, httpOnly: boolean) {
  return `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}; ${httpOnly ? 'HttpOnly; ' : ''}${prod ? 'Secure; ' : ''}`.trim();
}
export const signer = () =>
  process.env.SESSION_SECRET || 'development-only-secret-not-for-production';
export function issueCsrf() {
  const token = `${Date.now().toString(36)}.${randomToken()}`;
  return `${token}.${hmac(token, signer())}`;
}
export function enforceCsrf(req: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  const expected = process.env.APP_ORIGIN || 'http://localhost:5173';
  assert(origin === expected, 403, 'CSRF_REJECTED', 'Request origin is not allowed');
  const token = cookieValue(req, csrfCookie);
  const sent = req.headers.get('x-csrf-token') || '';
  assert(token.length > 45 && secureEqual(token, sent), 403, 'CSRF_REJECTED', 'Missing CSRF token');
  const parts = token.split('.');
  assert(parts.length === 3, 403, 'CSRF_REJECTED', 'Invalid CSRF token');
  const body = `${parts[0]}.${parts[1]}`;
  assert(
    secureEqual(parts[2], hmac(body, signer())),
    403,
    'CSRF_REJECTED',
    'Invalid CSRF signature',
  );
  assert(
    Date.now() - parseInt(parts[0], 36) < 24 * 3600000,
    403,
    'CSRF_REJECTED',
    'Expired CSRF token',
  );
}
export const csrfResponse = () => {
  const token = issueCsrf();
  return new Response(JSON.stringify({ data: { token } }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookieHeader(csrfCookie, token, 86400, false),
    },
  });
};
export function authResponse(data: unknown, rawToken: string, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookieHeader(sessionCookie, rawToken, 30 * 86400, true),
    },
  });
}
export const logoutResponse = () =>
  new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookieHeader(sessionCookie, '', 0, true) },
  });
