export const initials = (name?: string | null) =>
  name
    ?.split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('') || '?';
export function timeAgo(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(+d)) return '—';
  const diff = Date.now() - +d;
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diff) < 3600000) return fmt.format(-Math.round(diff / 60000), 'minute');
  if (Math.abs(diff) < 86400000) return fmt.format(-Math.round(diff / 3600000), 'hour');
  if (Math.abs(diff) < 30 * 86400000) return fmt.format(-Math.round(diff / 86400000), 'day');
  return d.toLocaleDateString();
}
export const fullTime = (value?: string) => (value ? new Date(value).toLocaleString() : '');
export const keyValues = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
export const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
