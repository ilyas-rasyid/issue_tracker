import { get, type Actor } from '../../../shared/api/index';

export type PublicUserProfile = {
  username: string;
  displayName: string | null;
  bio: string | null;
  githubUrl: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  stats: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedIssues: number;
    closedIssues: number;
  };
};

export function fetchPublicUserProfile(username: string) {
  return get<PublicUserProfile>(`/users/${encodeURIComponent(username)}`);
}
