import React from 'react';
import { Route, Routes, Navigate, Link, useLocation } from 'react-router-dom';
import { Header } from '../layouts/AppHeader';
import { useSession } from '../providers/SessionProvider';
import { Board } from '../../features/issues/pages/IssueBoardPage';
import { IssueDetail } from '../../features/issues/pages/IssueDetailPage';
import { CreateIssue } from '../../features/issues/pages/IssueEditorPage';
import {
  Login,
  Register,
  VerifyEmail,
  ForgotPassword,
  ResetPassword,
} from '../../features/auth/pages/index';
import { Settings } from '../../features/account/pages/SettingsPage';
import { PublicProfile } from '../../features/users/pages/PublicProfilePage';
export function Protected({
  children,
  verified = false,
}: {
  children: React.ReactNode;
  verified?: boolean;
}) {
  const { user, loading } = useSession(),
    location = useLocation();
  if (loading)
    return (
      <main className="page">
        <div className="muted">Checking session…</div>
      </main>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (verified && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}
const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);
export function App() {
  const { user } = useSession();
  const location = useLocation();
  const isAuthRoute = AUTH_PATHS.has(location.pathname);
  return (
    <>
      <Header />
      {user && !user.emailVerified && !isAuthRoute && (
        <div className="verification-strip">
          <span>Verify your email to publish issues and comments.</span>
          <Link to="/verify-email">Verify or resend</Link>
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Protected>
              <Board />
            </Protected>
          }
        />
        <Route
          path="/issues/new"
          element={
            <Protected verified>
              <CreateIssue />
            </Protected>
          }
        />
        <Route
          path="/issues/:key"
          element={
            <Protected>
              <IssueDetail />
            </Protected>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/u/:username"
          element={
            <Protected>
              <PublicProfile />
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              <Settings />
            </Protected>
          }
        />

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
      {!isAuthRoute && (
        <footer className="site-footer">
          <span>IssueTrack</span>
          <span>A focused issue tracker · Built for developers</span>
        </footer>
      )}
    </>
  );
}
