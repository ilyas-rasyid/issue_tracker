import { useState, type FormEvent } from 'react';
import { useSession } from '../../../app/providers/SessionProvider';
import { Button, Field } from '../../../shared/components/ui';
import { updatePassword, requestEmailChange } from '../services/account.service';
import { useAccountAction } from '../hooks/useAccountAction';
import { AccountFeedback } from './AccountFeedback';
/** Change password and request verification for a new email address. */
export function SecuritySettings() {
  const { user } = useSession();
  const { run, busy, error, success } = useAccountAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  if (!user) {
    return null;
  }
  function changePassword(event: FormEvent) {
    event.preventDefault();
    void run(
      () => updatePassword(currentPassword, newPassword),
      'Password changed. Other sessions have been revoked.',
    );
  }
  function changeEmail(event: FormEvent) {
    event.preventDefault();
    void run(
      () => requestEmailChange(newEmail, emailPassword),
      'Verification requested at the new email address.',
    );
  }
  return (
    <>
      <AccountFeedback error={error} success={success} />
      <section className="settings-section">
        <h2>Change password</h2>
        <form className="stacked-form" onSubmit={changePassword}>
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field
            label="New password"
            hint="Use at least 12 characters; choose a unique passphrase."
          >
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
          </Field>
          <Button busy={busy}>Update password</Button>
        </form>
      </section>

      <section className="settings-section">
        <h2>Change email</h2>
        <p className="muted">Your current email stays active until the new one is verified.</p>
        <form className="stacked-form" onSubmit={changeEmail}>
          <Field label="Current email">
            <input value={user.email} disabled />
          </Field>
          <Field label="New email">
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Current password">
            <input
              type="password"
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
              required
            />
          </Field>
          <Button variant="secondary" busy={busy}>
            Request email change
          </Button>
        </form>
      </section>
    </>
  );
}
