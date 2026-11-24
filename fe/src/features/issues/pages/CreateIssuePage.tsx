import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '../../../app/providers/SessionProvider';
import { IssueForm } from '../components/IssueForm';

export function CreateIssue() {
  const { user } = useSession();
  return (
    <main className="page narrow-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> All issues
      </Link>
      <div className="page-heading">
        <div>
          <h1>New issue</h1>
          <p>Describe the problem clearly so others can reproduce or understand it.</p>
        </div>
      </div>
      {user?.emailVerified ? (
        <IssueForm />
      ) : (
        <div className="notice">
          Verify your email first.
          <Link to="/verify-email">Go to verification</Link>
        </div>
      )}
    </main>
  );
}
