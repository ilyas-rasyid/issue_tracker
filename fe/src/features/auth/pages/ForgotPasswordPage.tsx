import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, Notice } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
import { requestPasswordReset } from '../services/auth.service';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email to request a password reset link."
    >
      {done ? (
        <div className="notice notice-success">
          If this email is registered, a reset link has been requested.
        </div>
      ) : (
        <form className="stacked-form" onSubmit={submit}>
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error ? <Notice error={error} /> : null}
          <Button busy={busy} type="submit">
            Request reset link
          </Button>
        </form>
      )}
      <p className="auth-foot">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
}
