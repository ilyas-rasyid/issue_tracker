import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const hmac = (v: string, key: string) => createHmac('sha256', key).update(v).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const secret = () =>
  process.env.SESSION_SECRET || 'development-only-secret-not-for-production';
export const fingerprint = (v: unknown) => hmac(JSON.stringify(v), secret());
export function hmacKeys(): {
  version: string;
  secret: string;
}[] {
  const raw = process.env.USERNAME_HMAC_KEYS || 'v1=development-only-username-key-please-replace';
  const keys = raw.split(',').map((x) => {
    const [version, ...secretPieces] = x.trim().split('=');
    return { version, secret: secretPieces.join('=') };
  });
  if (keys.some((k) => !/^v\d+$/.test(k.version) || k.secret.length < 24)) {
    throw new Error('Invalid USERNAME_HMAC_KEYS');
  }
  return keys;
}
export const usernameKeys = (name: string) =>
  hmacKeys().map((k) => `${k.version}:${hmac(name, k.secret)}`);
export const liveUsernameKey = (name: string) => usernameKeys(name)[0];
export function secureEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
