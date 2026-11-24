import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Github, CalendarDays, ArrowLeft } from 'lucide-react';
import { Avatar, Badge, Empty, LoadingRows, Notice } from '../../../shared/components/ui/index';
import { fetchPublicUserProfile } from '../services/user.service';
import { fetchIssues } from '../../issues/services/issue.service';

export function PublicProfile() {
  const { username = '' } = useParams();
  const q = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchPublicUserProfile(username),
    staleTime: 120000,
    retry: false,
  });

  const issues = useQuery({
    queryKey: ['profile', username, 'issues'],
    queryFn: () => fetchIssues(`author=${encodeURIComponent(username)}&limit=10`),
    enabled: !!q.data,
    staleTime: 30000,
  });

  if (q.isPending) {
    return (
      <main className="page">
        <LoadingRows />
      </main>
    );
  }
  if (q.error) {
    return (
      <main className="page">
        <Empty
          title="Profile not found"
          detail="This account may have been deleted."
          action={
            <Link className="button button-secondary" to="/">
              Browse issues
            </Link>
          }
        />
      </main>
    );
  }
  if (!q.data) {
    return (
      <main className="page">
        <Empty title="Profile not found" />
      </main>
    );
  }

  const p = q.data;
  return (
    <main className="page profile-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> All issues
      </Link>
      <div className="profile-hero">
        <Avatar
          size={64}
          user={{ username: p.username, displayName: p.displayName, avatarUrl: p.avatarUrl }}
        />
        <div>
          <h1>{p.displayName || p.username}</h1>
          <div className="mono muted">@{p.username}</div>
          {p.bio && <p>{p.bio}</p>}
          <div className="profile-links">
            <span>
              <CalendarDays size={15} /> Joined {new Date(p.joinedAt).toLocaleDateString()}
            </span>
            {p.githubUrl && (
              <a href={p.githubUrl} target="_blank" rel="noopener noreferrer">
                <Github size={15} /> GitHub
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="profile-stats">
        {[
          ['Total', p.stats.totalIssues],
          ['Open', p.stats.openIssues],
          ['In progress', p.stats.inProgressIssues],
          ['Resolved', p.stats.resolvedIssues],
          ['Closed', p.stats.closedIssues],
        ].map(([k, v]) => (
          <div key={k}>
            <strong>{v}</strong>
            <span>{k}</span>
          </div>
        ))}
      </div>

      <div className="section-heading">
        <h2>Reported issues</h2>
      </div>
      {issues.isPending ? (
        <LoadingRows count={4} />
      ) : issues.error ? (
        <Notice error={issues.error} />
      ) : !issues.data?.data.length ? (
        <Empty title="No issues yet" />
      ) : (
        <div className="profile-issues">
          {issues.data.data.map((i) => (
            <Link to={`/issues/${i.key}`} key={i.id}>
              <div>
                <span className="issue-key">{i.key}</span>
                <strong>{i.title}</strong>
              </div>
              <Badge value={i.status} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
