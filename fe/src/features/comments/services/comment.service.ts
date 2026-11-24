import { api, mutate, type Comment, type InfinitePage } from '../../../shared/api/index';

export function fetchComments(issueKey: string, cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api<InfinitePage<Comment>>(`/issues/${issueKey}/comments${query}`);
}

export function createComment(issueKey: string, content: string, clientRequestId: string) {
  return mutate<Comment>(`/issues/${issueKey}/comments`, 'POST', {
    content,
    clientRequestId,
  });
}

export function updateComment(commentId: string, content: string) {
  return mutate<Comment>(`/comments/${commentId}`, 'PATCH', { content });
}

export function deleteComment(commentId: string) {
  return mutate<void>(`/comments/${commentId}`, 'DELETE');
}
