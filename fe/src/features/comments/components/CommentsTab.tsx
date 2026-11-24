import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import type { Issue } from '../../../shared/api/index';
import { Button, Empty, LoadingRows, Modal, Notice } from '../../../shared/components/ui';
import { CommentItem } from './CommentItem';
import { useComments } from '../hooks/useComments';

export function CommentsTab({ issue }: { issue: Issue }) {
  const {
    user,
    q,
    comments,
    text,
    setText,
    busy,
    error,
    recent,
    deleting,
    setDeleting,
    add,
    edit,
    remove,
  } = useComments(issue);
  return (
    <section className="discussion">
      <div className="section-heading">
        <h2>
          Discussion
          <span className="muted">{issue.commentCount ?? ''}</span>
        </h2>
      </div>

      {q.isPending ? (
        <LoadingRows count={3} />
      ) : q.error ? (
        <Notice error={q.error} />
      ) : (
        <div className="comments-list">
          {comments.length === 0 ? (
            <Empty
              title="No comments yet"
              detail="Start the discussion by sharing additional context."
            />
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUsername={user?.username}
                issueClosed={issue.status === 'CLOSED'}
                onEdit={edit}
                onDelete={setDeleting}
              />
            ))
          )}
        </div>
      )}

      {q.hasNextPage && (
        <button
          className="load-more"
          disabled={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? 'Loading…' : 'Load more comments'}
        </button>
      )}

      {recent && !comments.some((c) => c.id === recent.id) && (
        <div className="notice notice-success">
          Your comment was posted. It will appear in the chronological discussion.
        </div>
      )}

      {issue.status === 'CLOSED' ? (
        <div className="locked-notice">
          <LockKeyhole size={16} /> Discussion is locked. Reopen the issue to comment.
        </div>
      ) : !user ? (
        <div className="join-note">
          <Link to={`/login?returnTo=${encodeURIComponent(`/issues/${issue.key}`)}`}>Log in</Link>{' '}
          to join the discussion.
        </div>
      ) : !user.emailVerified ? (
        <div className="join-note">
          <Link to="/verify-email">Verify your email</Link> to post comments.
        </div>
      ) : (
        <form className="comment-composer" onSubmit={add}>
          <label htmlFor="new-comment">Add a comment</label>
          <textarea
            id="new-comment"
            rows={4}
            maxLength={2000}
            placeholder="Share what you found…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="composer-bottom">
            <span>{text.length}/2000</span>
            <Button type="submit" disabled={!text.trim()} busy={busy}>
              Post comment
            </Button>
          </div>
        </form>
      )}

      {error ? <Notice error={error} /> : null}
      <Modal
        open={!!deleting}
        title="Delete comment?"
        description="This comment will disappear from the public discussion."
        onClose={() => setDeleting(null)}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete comment
          </Button>
        </div>
      </Modal>
    </section>
  );
}
