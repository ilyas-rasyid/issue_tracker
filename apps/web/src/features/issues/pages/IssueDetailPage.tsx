import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Edit3, LockKeyhole, MessageCircle, Trash2 } from 'lucide-react';
import {
  get,
  mutate,
  type Issue,
  type Activity,
  queryKeys,
  statusLabels,
  timeAgo,
  fullTime,
} from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  LoadingRows,
  Modal,
  Notice,
} from '../../../shared/components/ui/index';
import { Markdown } from '../../../shared/components/markdown/Markdown';
import { IssueForm } from './IssueEditorPage';
import { ActorName } from '../components/ActorName';
import { AttachmentSection } from '../../attachments/components/AttachmentSection';
import { CommentsTab } from '../../comments/components/CommentsTab';
import { ActivityTab } from '../../activities/components/ActivityTab';
export function IssueDetail() {
  const { key = '' } = useParams(),
    { user } = useSession(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    [tab, setTab] = useState<'discussion' | 'activity'>('discussion'),
    [editing, setEditing] = useState(false),
    [confirmClose, setConfirmClose] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: queryKeys.issue(key),
    queryFn: () => get<Issue>(`/issues/${key}`),
    staleTime: 30000,
    retry: false,
  });
  if (q.isPending)
    return (
      <main className="page">
        <LoadingRows />
      </main>
    );
  if (q.error)
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
  if (!q.data)
    return (
      <main className="page">
        <Empty title="Issue not found" />
      </main>
    );
  const issue = q.data,
    owner = !!(user && issue.author?.username === user.username);
  function refresh() {
    qc.invalidateQueries({ queryKey: queryKeys.issue(key) });
    qc.invalidateQueries({ queryKey: ['issues'] });
  }
  async function changeStatus(next: string) {
    setBusy(true);
    setError(null);
    try {
      await mutate(`/issues/${key}/status`, 'PATCH', {
        status: next,
        expectedVersion: issue.version,
      });
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
      await mutate(`/issues/${key}`, 'DELETE');
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

        <aside className="metadata-panel">
          <div className="metadata-inner">
            <h2>Properties</h2>
            {issue.project ? (
              <div className="property">
                <span>Project</span>
                <Link
                  className="actor-link"
                  to={`/?project=${encodeURIComponent(issue.project.slug)}`}
                >
                  {issue.project.name}
                </Link>
              </div>
            ) : null}
            <div className="property">
              <span>Status</span>
              <Badge value={issue.status} />
            </div>
            <div className="property">
              <span>Priority</span>
              <Badge value={issue.priority} kind="priority" />
            </div>
            <div className="property">
              <span>Type</span>
              <Badge value={issue.type} kind="type" />
            </div>
            <div className="property">
              <span>Author</span>
              <ActorName user={issue.author} />
            </div>
            <div className="property">
              <span>Updated</span>
              <span title={fullTime(issue.updatedAt)}>{timeAgo(issue.updatedAt)}</span>
            </div>

            {owner && (
              <div className="owner-controls">
                <h3>Manage issue</h3>
                {issue.allowedTransitions?.map((s) => (
                  <Button
                    key={s}
                    variant="secondary"
                    disabled={busy}
                    onClick={() => (s === 'CLOSED' ? setConfirmClose(true) : changeStatus(s))}
                  >
                    {issue.status === 'CLOSED'
                      ? 'Reopen issue'
                      : s === 'CLOSED'
                        ? 'Close issue'
                        : `Move to ${statusLabels[s]}`}
                  </Button>
                ))}
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  <Trash2 size={15} /> Delete issue
                </Button>
              </div>
            )}

            {issue.status === 'CLOSED' && (
              <div className="sidebar-lock">
                <LockKeyhole size={15} /> Editing and discussion are locked.
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={confirmClose}
        title="Close this issue?"
        description="Closing locks editing and new comments until the issue is reopened."
        onClose={() => setConfirmClose(false)}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirmClose(false)}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => changeStatus('CLOSED')}>
            Close issue
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        title="Delete this issue?"
        description="The issue and its discussion will immediately disappear from public view. This action cannot be undone."
        onClose={() => setConfirmDelete(false)}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} onClick={deleteIssue}>
            Delete issue
          </Button>
        </div>
      </Modal>
    </main>
  );
}
