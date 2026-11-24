import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Edit3, MessageCircle } from 'lucide-react';
import { queryKeys, timeAgo } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Avatar, Button, Empty, LoadingRows, Notice } from '../../../shared/components/ui/index';
import { Markdown } from '../../../shared/components/markdown/Markdown';
import { IssueForm } from '../components/IssueForm';
import { IssueMetadataPanel } from '../components/IssueMetadataPanel';
import { IssueActionDialogs } from '../components/IssueActionDialogs';
import { ActorName } from '../components/ActorName';
import { AttachmentSection } from '../../attachments/components/AttachmentSection';
import { CommentsTab } from '../../comments/components/CommentsTab';
import { ActivityTab } from '../../activities/components/ActivityTab';
import {
  fetchIssue,
  updateIssueStatus,
  deleteIssue as deleteIssueApi,
} from '../services/issue.service';

export function IssueDetail() {
  const { key = '' } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'discussion' | 'activity'>('discussion');
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const q = useQuery({
    queryKey: queryKeys.issue(key),
    queryFn: () => fetchIssue(key),
    staleTime: 30000,
    retry: false,
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
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> All issues
        </Link>
        <Empty
          title="Issue not available"
          detail="It may have been removed or the link is incorrect."
          action={
            <Link className="button button-secondary" to="/">
              Back to issues
            </Link>
          }
        />
      </main>
    );
  }
  if (!q.data) {
    return (
      <main className="page">
        <Empty title="Issue not found" />
      </main>
    );
  }

  const issue = q.data;
  const owner = !!(user && issue.author?.username === user.username);

  function refresh() {
    qc.invalidateQueries({ queryKey: queryKeys.issue(key) });
    qc.invalidateQueries({ queryKey: ['issues'] });
  }

  async function changeStatus(next: string) {
    setBusy(true);
    setError(null);
    try {
      await updateIssueStatus(key, next, issue.version);
      refresh();
      qc.invalidateQueries({ queryKey: queryKeys.activities(key) });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setConfirmClose(false);
    }
  }

  async function deleteIssue() {
    setBusy(true);
    try {
      await deleteIssueApi(key);
      qc.invalidateQueries({ queryKey: ['issues'] });
      navigate('/');
    } catch (e) {
      setError(e);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const editable = owner && issue.status !== 'CLOSED';

  return (
    <main className="page issue-detail">
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> All issues
      </Link>
      <div className="detail-hero">
        <div className="issue-key">
          {issue.key}
          <span className="issue-type">{issue.type.toLowerCase()}</span>
        </div>
        <h1>{issue.title}</h1>
        <div className="detail-byline">
          <Avatar user={issue.author} size={22} />
          <ActorName user={issue.author} />
          <span>opened {timeAgo(issue.createdAt)}</span>
        </div>
      </div>

      {error ? <Notice error={error} /> : null}

      <div className="detail-grid">
        <div className="detail-content">
          {editing ? (
            <div className="edit-section">
              <h2>Edit issue</h2>
              <IssueForm
                issue={issue}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  refresh();
                }}
              />
            </div>
          ) : (
            <section className="detail-section markdown-section">
              <div className="section-heading">
                <h2>Description</h2>
                {editable && (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    <Edit3 size={14} /> Edit
                  </Button>
                )}
              </div>
              <Markdown>{issue.description || ''}</Markdown>
            </section>
          )}

          <AttachmentSection issue={issue} owner={owner} onUpdated={refresh} />

          <div className="detail-tabs" role="tablist" aria-label="Issue content">
            <button
              role="tab"
              aria-selected={tab === 'discussion'}
              onClick={() => setTab('discussion')}
            >
              <MessageCircle size={16} /> Discussion
            </button>
            <button
              role="tab"
              aria-selected={tab === 'activity'}
              onClick={() => setTab('activity')}
            >
              <Clock3 size={16} /> Activity
            </button>
          </div>

          {tab === 'discussion' ? <CommentsTab issue={issue} /> : <ActivityTab issue={issue} />}
        </div>

        <IssueMetadataPanel
          issue={issue}
          owner={owner}
          busy={busy}
          changeStatus={changeStatus}
          requestClose={() => setConfirmClose(true)}
          requestDelete={() => setConfirmDelete(true)}
        />
      </div>

      <IssueActionDialogs
        confirmClose={confirmClose}
        confirmDelete={confirmDelete}
        busy={busy}
        cancelClose={() => setConfirmClose(false)}
        cancelDelete={() => setConfirmDelete(false)}
        changeStatus={changeStatus}
        deleteIssue={deleteIssue}
      />
    </main>
  );
}
