import { api, type Activity, type InfinitePage } from '../../../shared/api/index';

export function fetchActivities(issueKey: string, cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api<InfinitePage<Activity>>(`/issues/${issueKey}/activities${query}`);
}
