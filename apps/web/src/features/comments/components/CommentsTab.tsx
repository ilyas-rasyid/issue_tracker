import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import {
  api,
  mutate,
  type Issue,
  type Comment,
  type InfinitePage,
  queryKeys,
  timeAgo,
  fullTime,
} from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import {
  Avatar,
  Button,
  Empty,
  LoadingRows,
  Modal,
  Notice,
} from '../../../shared/components/ui/index';
import { ActorName } from '../../issues/components/ActorName';
export function CommentsTab({ issue }: { issue: Issue }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    commentRequestId = useRef(crypto.randomUUID()),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [recent, setRecent] = useState<Comment | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState(''),
    [deleting, setDeleting] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: queryKeys.comments(issue.key),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<InfinitePage<Comment>>(
        `/issues/${issue.key}/comments?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.meta.nextCursor || undefined,
    staleTime: 30000,
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await mutate<Comment>(`/issues/${issue.key}/comments`, 'POST', {
        clientRequestId: commentRequestId.current,
        content: text,
      });
      setRecent(comment);
      setText('');
      commentRequestId.current = crypto.randomUUID();
      qc.invalidateQueries({ queryKey: queryKeys.comments(issue.key) });
      qc.invalidateQueries({ queryKey: queryKeys.activities(issue.key) });
      qc.invalidateQueries({ queryKey: queryKeys.issue(issue.key) });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function edit(c: Comment) {
    try {
      await mutate(`/comments/${c.id}`, 'PATCH', { content: editText });
      setEditing(null);
      qc.invalidateQueries({ queryKey: queryKeys.comments(issue.key) });
    } catch (e) {
      setError(e);
    }
  }
  async function remove() {
    if (!deleting) return;
    try {
      await mutate(`/comments/${deleting}`, 'DELETE');
      setRecent((p) => (p?.id === deleting ? null : p));
      setDeleting(null);
      qc.invalidateQueries({ queryKey: queryKeys.comments(issue.key) });
      qc.invalidateQueries({ queryKey: queryKeys.issue(issue.key) });
    } catch (e) {
      setError(e);
    }
  }
  const comments = q.data?.pages.flatMap((p) => p.data) || [];
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
              <article className="comment" key={c.id}>
                <Avatar user={c.author} />
                <div className="comment-body">
                  <div className="comment-top">
                    <div>
                      <ActorName user={c.author} />
                      <span className="comment-date" title={fullTime(c.createdAt)}>
                        {timeAgo(c.createdAt)}
                        {c.isEdited ? ' · edited' : ''}
                      </span>
                    </div>
                    {user && c.author?.username === user.username && (
                      <div className="text-actions">
                        {issue.status !== 'CLOSED' && (
                          <button
                            onClick={() => {
                              setEditing(c.id);
                              setEditText(c.content);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        <button onClick={() => setDeleting(c.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                  {editing === c.id ? (
                    <div className="comment-edit">
                      <textarea
                        rows={3}
                        value={editText}
                        maxLength={2000}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="form-actions">
                        <Button variant="secondary" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button disabled={!editText.trim()} onClick={() => edit(c)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-content">{c.content}</p>
                  )}
                </div>
              </article>
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
