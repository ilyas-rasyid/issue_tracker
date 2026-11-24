import { z } from 'zod';
import { AppError } from '../errors/app-error';
export function encodeCursor(createdAt: Date, id: string, scope: string) {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id, scope })).toString(
    'base64url',
  );
}
export function decodeCursor(cursor: string | undefined, scope: string) {
  if (!cursor) {
    return undefined;
  }
  try {
    if (cursor.length > 400) {
      throw Error();
    }
    const o = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (
      o.scope !== scope ||
      !z.uuid().safeParse(o.id).success ||
      !Number.isFinite(Date.parse(o.t))
    ) {
      throw Error();
    }
    return { date: new Date(o.t), id: o.id as string };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Cursor is invalid or belongs to another query');
  }
}
export function cursorWhere(
  cursor: ReturnType<typeof decodeCursor>,
  direction: 'asc' | 'desc',
): any {
  if (!cursor) {
    return {};
  }
  const op = direction === 'asc' ? 'gt' : 'lt';
  return {
    OR: [{ createdAt: { [op]: cursor.date } }, { createdAt: cursor.date, id: { [op]: cursor.id } }],
  };
}
export function pageParams(url: URL) {
  let p = Number(url.searchParams.get('page') || 1);
  let l = Number(url.searchParams.get('limit') || 10);
  if (!Number.isInteger(p) || p < 1 || ![10, 20, 50].includes(l)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid page or limit');
  }
  return { page: p, limit: l };
}
export function cursorLimit(url: URL, def = 20) {
  const l = Number(url.searchParams.get('limit') || def);
  if (!Number.isInteger(l) || l < 1 || l > 50) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid limit');
  }
  return l;
}
