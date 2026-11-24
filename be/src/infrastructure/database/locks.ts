import { assert } from '../../commons/errors/app-error';
export async function lockUser(tx: any, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
  const u = await tx.user.findUnique({ where: { id: userId } });
  assert(u && !u.deletedAt, 401, 'UNAUTHORIZED', 'Account is no longer active');
  return u;
}
export async function lockIssue(tx: any, issueId: string) {
  await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${issueId}::uuid FOR UPDATE`;
}
