import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { mutate } from '../../../shared/api/index';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Button, Field, Notice } from '../../../shared/components/ui/index';
import { AuthShell, ValidReturn } from '../components/AuthShell';
export function Login() {
  const nav = useNavigate(),
    [params] = useSearchParams(),
    qc = useQueryClient(),
    { refresh } = useSession(),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mutate('/auth/login', 'POST', { email, password });
      await refresh();
      broadcastAuth('change');
      nav(ValidReturn(params.get('returnTo')), { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage issues and join the discussion.">
      <form className="stacked-form" onSubmit={submit}>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <div className="form-between">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {error ? <Notice error={error} /> : null}
        <Button type="submit" busy={busy}>
          Log in
        </Button>
      </form>
      <p className="auth-foot">
        New to IssueTrack? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
