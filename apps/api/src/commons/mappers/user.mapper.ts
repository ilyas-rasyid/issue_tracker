export const safeUser = (u: any) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarKey ? `/api/v1/users/${u.username}/avatar` : null,
  emailVerified: !!u.emailVerifiedAt,
});
export const actorDto = (u: any) =>
  u && !u.deletedAt && u.username
    ? {
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarKey ? `/api/v1/users/${u.username}/avatar` : null,
      }
    : null;
