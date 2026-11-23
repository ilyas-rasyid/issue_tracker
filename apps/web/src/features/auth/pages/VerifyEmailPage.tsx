import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { mutate } from '../../../shared/api/index';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Button, Notice } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
export function VerifyEmail() {
  const [params] = useSearchParams(),
    token = params.get('token'),
    mode = params.get('mode'),
    { user, refresh } = useSession(),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setBusy(true);
    mutate(mode === 'change' ? '/account/verify-email' : '/auth/verify-email', 'POST', { token })
      .then(() => {
        if (alive) {
          setDone(true);
          refresh();
          broadcastAuth('change');
        }
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [token, mode]);
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await mutate('/auth/resend-verification', 'POST');
      setSent(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      title="Verify your email"
      subtitle="An email address must be confirmed before publishing issues or comments."
    >
      {done || (user?.emailVerified && !token) ? (
        <div className="notice notice-success">
          <CheckCircle2 size={18} /> Email verified.
          <Link to="/">Continue to issues</Link>
        </div>
      ) : (
        <div className="stacked-form">
          <div className="verify-icon">
            <Mail size={26} />
          </div>
          <p className="muted">
            {busy
              ? 'Checking verification…'
              : token
                ? 'Confirming your link. If it is expired, request another.'
                : 'Check your inbox for a verification link.'}
          </p>
          {sent && (
            <div className="notice notice-success">
              Verification email requested. Check your inbox.
            </div>
          )}
          {error ? <Notice error={error} /> : null}
          <Button type="button" variant="secondary" busy={busy} disabled={!user} onClick={resend}>
            Resend verification email
          </Button>
          <Link className="inline-link" to="/">
            Back to issues
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
