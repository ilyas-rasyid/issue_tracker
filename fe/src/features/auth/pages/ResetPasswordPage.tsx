import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Field, Notice } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
import { resetPassword } from '../services/auth.service';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Min. 6 characters with an uppercase letter, a number, and a special character."
    >
      {done ? (
        <div className="notice notice-success">
          Password updated. <Link to="/login">Log in again</Link>.
        </div>
      ) : (
        <form className="stacked-form" onSubmit={submit}>
          <Field label="New password">
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {!token && <div className="notice notice-error">A reset token is missing.</div>}
          {error ? <Notice error={error} /> : null}
          <Button busy={busy} disabled={!token} type="submit">
            Change password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
