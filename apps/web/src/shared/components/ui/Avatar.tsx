import { initials, type Actor } from '../../api/index';
export function Avatar({ user, size = 32 }: { user: Actor; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" />
      ) : (
        <span>{initials(user?.displayName || user?.username)}</span>
      )}
    </span>
  );
}
