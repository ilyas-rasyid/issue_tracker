import { useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { type Issue, type Comment, queryKeys } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
} from '../services/comment.service';

/** Owns comment pagination, creation/editing, deletion and idempotency keys. */
export function useComments(issue: Issue) {
  const { user } = useSession();
  const qc = useQueryClient();
  const commentRequestId = useRef(crypto.randomUUID());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [recent, setRecent] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const q = useInfiniteQuery({
    queryKey: queryKeys.comments(issue.key),
    initialPageParam: '',
    queryFn: ({ pageParam }) => fetchComments(issue.key, pageParam || null),
    getNextPageParam: (last) => last.meta.nextCursor || undefined,
    staleTime: 30000,
  });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const comment = await createComment(issue.key, text, commentRequestId.current);
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

  async function edit(c: Comment, content: string) {
    try {
      await updateComment(c.id, content);
      qc.invalidateQueries({ queryKey: queryKeys.comments(issue.key) });
      return true;
    } catch (e) {
      setError(e);
      return false;
    }
  }

  async function remove() {
    if (!deleting) {
      return;
    }
    try {
      await deleteComment(deleting);
      setRecent((p) => (p?.id === deleting ? null : p));
      setDeleting(null);
      qc.invalidateQueries({ queryKey: queryKeys.comments(issue.key) });
      qc.invalidateQueries({ queryKey: queryKeys.issue(issue.key) });
    } catch (e) {
      setError(e);
    }
  }

  const comments = q.data?.pages.flatMap((p) => p.data) || [];

  return {
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
  };
}
