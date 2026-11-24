import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Button, Modal, Notice } from '../../../shared/components/ui';
import { deleteAccount } from '../services/account.service';
/** Destructive account lifecycle action with password and typed confirmation. */
export function DeleteAccountSettings() {
  const { user, logoutLocal } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!user) {
    return null;
  }
  const currentUserId = user.id;
  async function confirmDeletion() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password, phrase);
      sessionStorage.removeItem(`tracker-draft:${currentUserId}:create`);
      logoutLocal();
      broadcastAuth('logout');
      navigate('/');
    } catch (cause) {
      setError(cause);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section danger-zone">
      <h2>
        <AlertTriangle size={18} /> Delete account
      </h2>
      <p>
        Deleting your account immediately hides your public profile, issues, and comments. You will
        permanently lose access.
      </p>
      <p className="muted">
        Content is purged after 90 days; limited audit metadata follows the 365-day policy. Your
        username can never be reused.
      </p>
      {error ? <Notice error={error} /> : null}
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Modal
        open={open}
        title="Permanently delete your account?"
        description="This action cannot be undone. Confirm your password and type DELETE."
        onClose={() => setOpen(false)}
      >
        <div className="stacked-form">
          <label className="field-label" htmlFor="delete-password">
            Current password
          </label>
          <input
            id="delete-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="field-label" htmlFor="delete-confirm">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirm"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
          />
          <div className="dialog-actions">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              disabled={!password || phrase !== 'DELETE'}
              onClick={() => void confirmDeletion()}
            >
              Delete account permanently
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
