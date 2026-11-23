export const queryKeys = {
  auth: ['auth', 'me'] as const,
  projects: ['projects', 'list'] as const,
  issues: (params: string) => ['issues', 'list', params] as const,
  board: (params: string) => ['issues', 'board', params] as const,
  issue: (key: string) => ['issues', 'detail', key] as const,
  comments: (key: string) => ['issues', key, 'comments'] as const,
  activities: (key: string) => ['issues', key, 'activities'] as const,
  notifs: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread-count'] as const,
};
