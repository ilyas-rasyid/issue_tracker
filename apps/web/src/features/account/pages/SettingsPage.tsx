import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, AlertTriangle } from 'lucide-react';
import { get, mutate } from '../../../shared/api/index';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Avatar, Button, Field, Modal, Notice } from '../../../shared/components/ui/index';
export function Settings() {
  const { user, logoutLocal, refresh } = useSession(),
    qc = useQueryClient(),
    navigate = useNavigate();
  const [section, setSection] = useState<'profile' | 'security' | 'danger'>('profile');
  const profile = useQuery({
    queryKey: ['settings', 'profile', user?.username],
    queryFn: () => get<any>(`/users/${user?.username}`),
    enabled: !!user,
  });
  const [displayName, setDisplayName] = useState<string | null>(null),
    [bio, setBio] = useState<string | null>(null),
    [githubUrl, setGithubUrl] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    avatarRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(''),
    [newPass, setNewPass] = useState(''),
    [newEmail, setNewEmail] = useState(''),
    [passwordForEmail, setPasswordForEmail] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false),
    [deletePassword, setDeletePassword] = useState(''),
    [deletePhrase, setDeletePhrase] = useState('');
  async function run(callback: () => Promise<any>, successMessage: string) {
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await callback();
      setSuccess(successMessage);
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const input: any = {};
    if (displayName !== null) input.displayName = displayName;
    if (bio !== null) input.bio = bio || null;
    if (githubUrl !== null) input.githubUrl = githubUrl || null;
    if (!Object.keys(input).length) return;
    await run(() => mutate('/account/profile', 'PATCH', input), 'Profile updated.');
  }
  async function uploadAvatar(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await run(() => mutate('/account/avatar', 'PUT', form), 'Avatar updated.');
  }
  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await mutate('/account', 'DELETE', { password: deletePassword, confirmation: deletePhrase });
      sessionStorage.removeItem(`tracker-draft:${user?.id}:create`);
      logoutLocal();
      broadcastAuth('logout');
      navigate('/');
    } catch (e) {
      setError(e);
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;
  return (
    <main className="page settings-page">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage your public profile and account security.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {(['profile', 'security', 'danger'] as const).map((s) => (
            <button
              type="button"
              key={s}
              className={section === s ? 'active' : ''}
              onClick={() => {
                setSection(s);
                setError(null);
                setSuccess('');
              }}
            >
              {s === 'profile' ? 'Profile' : s === 'security' ? 'Security' : 'Delete account'}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          {error ? <Notice error={error} /> : null}
          {success && (
            <div className="notice notice-success">
              <Check size={16} />
              {success}
            </div>
          )}

          {section === 'profile' && (
            <>
              <section className="settings-section">
                <h2>Public profile</h2>
                <p className="muted">Visible to anyone browsing your issues.</p>
                <div className="avatar-setting">
                  <Avatar
                    user={{
                      username: user.username,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                    }}
                    size={56}
                  />
                  <div>
                    <input
                      ref={avatarRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(e) => {
                        uploadAvatar(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => avatarRef.current?.click()}
                    >
                      <Camera size={15} /> Change avatar
                    </Button>
                    {user.avatarUrl && (
                      <button
                        className="text-button"
                        onClick={() =>
                          run(() => mutate('/account/avatar', 'DELETE'), 'Avatar removed.')
                        }
                      >
                        Remove
                      </button>
                    )}
                    <small>PNG, JPEG, WebP · 2 MiB maximum</small>
                  </div>
                </div>
                <form className="stacked-form" onSubmit={saveProfile}>
                  <Field label="Username" hint="Username is permanent and cannot be changed.">
                    <input value={user.username} disabled />
                  </Field>
                  <Field label="Display name">
                    <input
                      value={displayName ?? profile.data?.displayName ?? user.displayName ?? ''}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Bio">
                    <textarea
                      rows={4}
                      value={bio ?? profile.data?.bio ?? ''}
                      maxLength={500}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="A few words about what you build"
                    />
                  </Field>
                  <Field label="GitHub profile URL">
                    <input
                      type="url"
                      value={githubUrl ?? profile.data?.githubUrl ?? ''}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                    />
                  </Field>
                  <div className="form-actions">
                    <Button busy={busy}>Save profile</Button>
                  </div>
                </form>
              </section>
            </>
          )}

          {section === 'security' && (
            <>
              <section className="settings-section">
                <h2>Change password</h2>
                <form
                  className="stacked-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      () =>
                        mutate('/account/change-password', 'POST', {
                          currentPassword: current,
                          newPassword: newPass,
                        }),
                      'Password changed. Other sessions have been revoked.',
                    );
                  }}
                >
                  <Field label="Current password">
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="New password"
                    hint="Min. 6 characters, with an uppercase letter, number, and special character."
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      minLength={6}
                      required
                    />
                  </Field>
                  <Button busy={busy}>Update password</Button>
                </form>
              </section>
              <section className="settings-section">
                <h2>Change email</h2>
                <p className="muted">
                  Your current email remains active until the new address is verified.
                </p>
                <form
                  className="stacked-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      () =>
                        mutate('/account/change-email', 'POST', {
                          newEmail,
                          password: passwordForEmail,
                        }),
                      'Verification requested at the new email address.',
                    );
                  }}
                >
                  <Field label="Current email">
                    <input value={user.email} disabled />
                  </Field>
                  <Field label="New email">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Current password">
                    <input
                      type="password"
                      value={passwordForEmail}
                      onChange={(e) => setPasswordForEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Button variant="secondary" busy={busy}>
                    Request email change
                  </Button>
                </form>
              </section>
            </>
          )}

          {section === 'danger' && (
            <section className="settings-section danger-zone">
              <h2>
                <AlertTriangle size={18} /> Delete account
              </h2>
              <p>
                Deleting your account hides your public profile, issues, and comments immediately.
                You will lose access permanently.
              </p>
              <p className="muted">
                Content is purged after 90 days; limited audit metadata follows the 365-day policy.
                Username is never reusable.
              </p>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete my account
              </Button>
            </section>
          )}
        </div>
      </div>

      <Modal
        open={deleteOpen}
        title="Delete your account permanently?"
        description="This action is irreversible. Enter your password and type DELETE to confirm."
        onClose={() => setDeleteOpen(false)}
      >
        <div className="stacked-form">
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </Field>
          <Field label="Type DELETE">
            <input
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="DELETE"
            />
          </Field>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              disabled={!deletePassword || deletePhrase !== 'DELETE'}
              onClick={deleteAccount}
            >
              Permanently delete
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
