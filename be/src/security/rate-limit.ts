import { AppError } from '../commons/errors/app-error';
export const windowMap = new Map<
  string,
  {
    count: number;
    start: number;
  }
>();
export function limitRate(req: Request, scope: string, max: number, windowMs: number) {
  const ip = req.headers.get('x-real-ip') || 'local'; // Trust only a reverse proxy that overwrites this header.
  const key = `${scope}:${ip}`;
  const now = Date.now();
  let state = windowMap.get(key);
  if (!state || now - state.start >= windowMs) {
    state = { count: 0, start: now };
    windowMap.set(key, state);
  }
  if (++state.count > max) {
    throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later');
  }
  if (windowMap.size > 10000) {
    for (const [k, v] of windowMap) {
      if (now - v.start > windowMs) {
        windowMap.delete(k);
      }
    }
  }
}
