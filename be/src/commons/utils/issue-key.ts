import { AppError } from '../errors/app-error';
export const issueKey = (n: number) => `ISS-${String(n).padStart(3, '0')}`;
export function parseIssueKey(key: string) {
  const m = /^ISS-(\d+)$/i.exec(key);
  if (!m) {
    throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  }
  return Number(m[1]);
}
