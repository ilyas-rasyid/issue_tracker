import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../app/providers/SessionProvider';
interface ProtectedRouteProps {
  children: ReactNode;
  verified?: boolean;
}
/** Route-level UX gating; backend still enforces ownership and verified email. */
export function ProtectedRoute({ children, verified = false }: ProtectedRouteProps) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) {
    return (
      <main className="page">
        <div className="muted">Checking session…</div>
      </main>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  if (verified && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return <>{children}</>;
}
