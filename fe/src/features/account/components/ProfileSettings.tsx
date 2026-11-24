import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { useSession } from '../../../app/providers/SessionProvider';
import { Avatar, Button, Field } from '../../../shared/components/ui';
import {
  fetchAccountProfile,
  updateProfile,
  uploadAccountAvatar,
  removeAccountAvatar,
} from '../services/account.service';
import { useAccountAction } from '../hooks/useAccountAction';
import { AccountFeedback } from './AccountFeedback';
/** Public identity fields and avatar upload; username remains immutable. */
export function ProfileSettings() {
  const { user } = useSession();
  const avatarInput = useRef<HTMLInputElement>(null);
  const { run, busy, error, success } = useAccountAction();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['settings', 'profile', user?.username],
    queryFn: () => fetchAccountProfile(user!.username),
    enabled: Boolean(user),
  });
  if (!user) {
    return null;
  }
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const data: {
      displayName?: string;
      bio?: string | null;
      githubUrl?: string | null;
    } = {};
    if (displayName !== null) {
      data.displayName = displayName;
    }
    if (bio !== null) {
      data.bio = bio || null;
    }
    if (githubUrl !== null) {
      data.githubUrl = githubUrl || null;
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    void run(() => updateProfile(data), 'Profile updated.');
  }
  function onAvatarSelected(file?: File) {
    if (file) {
      void run(() => uploadAccountAvatar(file), 'Avatar updated.');
    }
  }
  return (
    <section className="settings-section">
      <h2>Public profile</h2>
      <p className="muted">Visible to anyone browsing your issues.</p>
      <AccountFeedback error={error} success={success} />

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
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              onAvatarSelected(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => avatarInput.current?.click()}
          >
            <Camera size={15} /> Change avatar
          </Button>
          {user.avatarUrl ? (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void run(removeAccountAvatar, 'Avatar removed.')}
            >
              Remove
            </button>
          ) : null}
          <small>PNG, JPEG, WebP · 2 MiB maximum</small>
        </div>
      </div>

      <form className="stacked-form" onSubmit={handleSubmit}>
        <Field label="Username" hint="Username is permanent and cannot be changed.">
          <input value={user.username} disabled />
        </Field>
        <Field label="Display name">
          <input
            value={displayName ?? profile.data?.displayName ?? user.displayName ?? ''}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={100}
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={4}
            value={bio ?? profile.data?.bio ?? ''}
            maxLength={500}
            onChange={(event) => setBio(event.target.value)}
            placeholder="A few words about what you build"
          />
        </Field>
        <Field label="GitHub profile URL">
          <input
            type="url"
            value={githubUrl ?? profile.data?.githubUrl ?? ''}
            onChange={(event) => setGithubUrl(event.target.value)}
            placeholder="https://github.com/username"
          />
        </Field>
        <div className="form-actions">
          <Button busy={busy}>Save profile</Button>
        </div>
      </form>
    </section>
  );
}
