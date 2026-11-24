import { api, get, mutate, type Issue, type Page } from '../../../shared/api/index';

export type BoardColumnsResponse = {
  data: {
    columns: Record<
      string,
      {
        data: Issue[];
        total: number;
        hasMore: boolean;
        nextCursor: string | null;
      }
    >;
  };
};

export function fetchIssues(query: string) {
  return api<Page<Issue>>(`/issues?${query}`);
}

export function fetchIssueBoard(query: string) {
  return api<BoardColumnsResponse>(`/issues/board?${query}`);
}

export function fetchIssue(key: string) {
  return get<Issue>(`/issues/${key}`);
}

export function createIssue(data: {
  title: string;
  description: string;
  type: string;
  priority: string;
  projectId?: string | null;
  clientRequestId: string;
}) {
  return mutate<Issue>('/issues', 'POST', data);
}

export function updateIssue(
  key: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    projectId?: string | null;
    expectedVersion: number;
  },
) {
  return mutate<Issue>(`/issues/${key}`, 'PATCH', data);
}

export function updateIssueStatus(key: string, status: string, expectedVersion: number) {
  return mutate<{
    key: string;
    status: string;
    previousStatus: string;
    version: number;
    allowedTransitions: string[];
    updatedAt: string;
  }>(`/issues/${key}/status`, 'PATCH', {
    status,
    expectedVersion,
  });
}

export function deleteIssue(key: string) {
  return mutate<void>(`/issues/${key}`, 'DELETE');
}
