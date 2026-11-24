import { Link } from 'react-router-dom';
import { Trash2, LockKeyhole } from 'lucide-react';
import { statusLabels, timeAgo, fullTime, type Issue } from '../../../shared/api/index';
import { Badge, Button } from '../../../shared/components/ui';
import { ActorName } from './ActorName';

interface IssueMetadataPanelProps {
  issue: Issue;
  owner: boolean;
  busy: boolean;
  changeStatus: (next: string) => Promise<void>;
  requestClose: () => void;
  requestDelete: () => void;
}

/** Properties and permission-aware issue actions in the desktop metadata column. */
export function IssueMetadataPanel({
  issue,
  owner,
  busy,
  changeStatus,
  requestClose,
  requestDelete,
}: IssueMetadataPanelProps) {
  return (
    <aside className="metadata-panel">
      <div className="metadata-inner">
        <h2>Properties</h2>
        {issue.project ? (
          <div className="property">
            <span>Project</span>
            <Link className="actor-link" to={`/?project=${encodeURIComponent(issue.project.slug)}`}>
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
                onClick={() => (s === 'CLOSED' ? requestClose() : changeStatus(s))}
              >
                {issue.status === 'CLOSED'
                  ? 'Reopen issue'
                  : s === 'CLOSED'
                    ? 'Close issue'
                    : `Move to ${statusLabels[s]}`}
              </Button>
            ))}
            <Button variant="danger" onClick={() => requestDelete()} disabled={busy}>
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
  );
}
