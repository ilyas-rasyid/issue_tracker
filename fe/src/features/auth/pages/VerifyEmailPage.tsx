import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { useSession, broadcastAuth } from '../../../app/providers/SessionProvider';
import { Button, Notice } from '../../../shared/components/ui/index';
import { AuthShell } from '../components/AuthShell';
import { verifyEmail, resendVerificationEmail } from '../services/auth.service';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const mode = params.get('mode');
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setBusy(true);
    verifyEmail(token, mode === 'change')
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
      await resendVerificationEmail();
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
