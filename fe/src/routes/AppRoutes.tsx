import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from '../app/layouts/AppHeader';
import { useSession } from '../app/providers/SessionProvider';
import { Board } from '../features/issues/pages/IssueBoardPage';
import { IssueDetail } from '../features/issues/pages/IssueDetailPage';
import { CreateIssue } from '../features/issues/pages/CreateIssuePage';
import {
  Login,
  Register,
  VerifyEmail,
  ForgotPassword,
  ResetPassword,
} from '../features/auth/pages';
import { Settings } from '../features/account/pages/SettingsPage';
import { PublicProfile } from '../features/users/pages/PublicProfilePage';
import { ProtectedRoute } from './ProtectedRoute';
const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);
/** Public board/detail/profile; verify email only for content creation. */
export function App() {
  const { user } = useSession();
  const location = useLocation();
  const isAuthRoute = AUTH_PATHS.has(location.pathname);
  return (
    <>
      <Header />
      {user && !user.emailVerified && !isAuthRoute ? (
        <div className="verification-strip">
          <span>Verify your email to publish issues and comments.</span>
          <Link to="/verify-email">Verify or resend</Link>
        </div>
      ) : null}

      <Routes>
        <Route path="/" element={<Board />} />
        <Route path="/issues/:key" element={<IssueDetail />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route
          path="/issues/new"
          element={
            <ProtectedRoute verified>
              <CreateIssue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="*"
          element={
            <main className="page">
              <div className="empty">
                <h1>Page not found</h1>
                <p className="muted">The page may have moved or never existed.</p>
                <Link className="button button-secondary" to="/">
                  Return to issues
                </Link>
              </div>
            </main>
          }
        />
      </Routes>

      {!isAuthRoute ? (
        <footer className="site-footer">
          <span>IssueTrack</span>
          <span>A focused issue tracker · Built for developers</span>
        </footer>
      ) : null}
    </>
  );
}
