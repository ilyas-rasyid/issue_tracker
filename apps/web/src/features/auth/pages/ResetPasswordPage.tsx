import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { mutate } from '../../../shared/api/index';
import { Button, Field, Notice } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
export function ResetPassword() {
  const [params] = useSearchParams(),
    token = params.get('token') || '',
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mutate('/auth/reset-password', 'POST', { token, newPassword: password });
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
