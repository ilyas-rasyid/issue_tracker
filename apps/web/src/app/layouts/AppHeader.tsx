import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, FolderPlus, GitPullRequest, LogOut, Settings, UserRound } from 'lucide-react';
import { Avatar } from '../../shared/components/ui/index';
import { mutate } from '../../shared/api/index';
import { useSession, broadcastAuth } from '../providers/SessionProvider';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { Notifications } from '../../features/notifications/components/NotificationCenter';
import { HeaderProjectPicker } from '../../features/projects/components/HeaderProjectPicker';
import { CreateProjectModal } from '../../features/projects/components/CreateProjectModal';

export function Header() {
  const { user, logoutLocal } = useSession();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  async function logout() {
    try {
      await mutate('/auth/logout', 'POST');
    } finally {
      logoutLocal();
      broadcastAuth('logout');
      nav('/');
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="IssueTrack home">
          <span className="brand-icon">
            <GitPullRequest size={20} strokeWidth={2.4} />
          </span>
          <span>IssueTrack</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          <NavLink to="/" end>
            Issues
          </NavLink>
        </nav>

        <HeaderProjectPicker />

        <div className="header-actions">
          <ThemeSwitcher />
          {user ? (
            <>
              {user.emailVerified ? (
                <button
                  type="button"
                  className="header-new"
                  onClick={() => setProjectModalOpen(true)}
                >
                  <FolderPlus size={16} /> New project
                </button>
              ) : (
                <Link className="header-new" to="/verify-email">
                  <FolderPlus size={16} /> New project
                </Link>
              )}
              <Notifications />
              <div className="account-menu">
                <button
                  className="account-trigger"
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  aria-expanded={menu}
                >
                  <Avatar
                    user={{
                      username: user.username,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                    }}
                    size={27}
                  />
                  <ChevronDown size={14} />
                </button>
                {menu && (
                  <div className="account-dropdown">
                    <span className="dropdown-user">@{user.username}</span>
                    <Link to={`/u/${user.username}`} onClick={() => setMenu(false)}>
                      <UserRound size={15} /> Profile
                    </Link>
                    <Link to="/settings" onClick={() => setMenu(false)}>
                      <Settings size={15} /> Settings
                    </Link>
                    <button
                      onClick={() => {
                        setMenu(false);
                        logout().catch(() => {});
                      }}
                    >
                      <LogOut size={15} /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="auth-links">
              <Link to="/login">Log in</Link>
              <Link className="header-new" to="/register">
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} />
    </header>
  );
}
