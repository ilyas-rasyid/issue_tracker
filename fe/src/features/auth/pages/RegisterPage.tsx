import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Button, Field, Notice, PasswordInput } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
import { registerUser } from '../services/auth.service';

const PASSWORD_RULES = [
  { key: 'len', label: 'Min. 6 characters', test: (v: string) => v.length >= 6 },
  { key: 'upper', label: 'Uppercase letter (A–Z)', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'num', label: 'Number (0–9)', test: (v: string) => /[0-9]/.test(v) },
  { key: 'sym', label: 'Special character (!@#…)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export function Register() {
  const nav = useNavigate();
  const { refresh } = useSession();
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(form.password));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordValid) {
      setError(
        new Error(
          'Password must be at least 6 characters and include an uppercase letter, a number, and a special character.',
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerUser({
        ...form,
        username: form.username.trim().toLowerCase(),
      });
      await refresh();
      broadcastAuth('change');
      nav('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === 'username' ? e.target.value.toLowerCase() : e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="A profile for your issues, comments, and activity."
    >
      <form className="stacked-form" onSubmit={submit}>
        <Field
          label="Username"
          hint="3–30 letters, digits, or underscores (saved in lowercase). Cannot be changed later."
        >
          <input
            value={form.username}
            onChange={set('username')}
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={3}
            maxLength={30}
            placeholder="developer_name"
          />
        </Field>
        <Field label="Display name">
          <input
            value={form.displayName}
            onChange={set('displayName')}
            required
            maxLength={100}
            placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="Min. 6 chars, A-Z, 0-9, symbol"
          />
          <ul className="password-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(form.password);
              return (
                <li key={rule.key} className={met ? 'met' : undefined}>
                  <Check size={12} aria-hidden="true" />
                  <span>{rule.label}</span>
                </li>
              );
            })}
          </ul>
        </Field>
        {error ? <Notice error={error} /> : null}
        <Button type="submit" busy={busy}>
          Create account
        </Button>
      </form>
      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
