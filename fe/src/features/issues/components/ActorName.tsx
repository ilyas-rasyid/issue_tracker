import { Link } from 'react-router-dom';
import { type Issue } from '../../../shared/api/index';
export function ActorName({ user }: { user: Issue['author'] }) {
  return user ? (
    <Link to={`/u/${user.username}`} className="actor-link">
      @{user.username}
    </Link>
  ) : (
    <span className="muted">Deleted user</span>
  );
}
