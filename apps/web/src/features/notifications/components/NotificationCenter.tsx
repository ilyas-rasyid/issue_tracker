import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  get,
  mutate,
  api,
  queryKeys,
  timeAgo,
  type Notification,
  type InfinitePage,
} from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
export function Notifications() {
  const { user } = useSession(),
    [open, setOpen] = useState(false),
    qc = useQueryClient(),
    navigate = useNavigate();
  const count = useQuery({
    queryKey: queryKeys.unread,
    queryFn: () =>
      get<{
        count: number;
      }>('/notifications/unread-count'),
    enabled: !!user,
    staleTime: 60000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  // Notification pages are loaded only when the panel opens; pagination is managed locally.
  const [pages, setPages] = useState<Notification[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false);
  async function fetchPage(next = false) {
    setLoading(true);
    try {
      const response = await api<InfinitePage<Notification>>(
        `/notifications?limit=20${next && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setPages((p) => (next ? [...p, ...response.data] : response.data));
      setCursor(response.meta.nextCursor);
      setMore(response.meta.hasMore);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (open && user) fetchPage(false).catch(() => {});
  }, [open, user?.id]);
  async function mark(n: Notification) {
    setPages((p) => p.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    qc.setQueryData(
      queryKeys.unread,
      (
        old:
          | {
              count: number;
            }
          | undefined,
      ) => (old ? { count: Math.max(0, old.count - (n.readAt ? 0 : 1)) } : old),
    );
    try {
      await mutate(`/notifications/${n.id}/read`, 'PATCH');
    } catch {
      qc.invalidateQueries({ queryKey: queryKeys.unread });
    }
    setOpen(false);
    navigate(`/issues/${n.issue.key}`);
  }
  async function markAll() {
    await mutate('/notifications/mark-all-read', 'POST');
    setPages((p) => p.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    qc.invalidateQueries({ queryKey: queryKeys.unread });
  }
  if (!user) return null;
  return (
    <div className="popover-anchor">
      <button
        className="icon-button bell-button"
        type="button"
        aria-label={`Notifications, ${count.data?.count || 0} unread`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={19} />
        {!!count.data?.count && (
          <span className="unread-indicator">
            {count.data.count > 99 ? '99+' : count.data.count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            className="popover-dismiss"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="notification-popover">
            <div className="notification-top">
              <strong>Notifications</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => markAll().catch(() => {})}
              >
                Mark all read
              </button>
            </div>
            {pages.length === 0 && !loading ? (
              <div className="empty compact">You're all caught up.</div>
            ) : null}
            <div className="notification-list">
              {pages.map((n) => (
                <button
                  key={n.id}
                  className={`notification-entry ${!n.readAt ? 'unread' : ''}`}
                  type="button"
                  onClick={() => mark(n)}
                >
                  <span className="notification-actor">
                    {n.actor?.displayName || n.actor?.username || 'Deleted user'} commented on
                  </span>
                  <strong>
                    {n.issue.key} · {n.issue.title}
                  </strong>
                  <small>{timeAgo(n.createdAt)}</small>
                </button>
              ))}
            </div>
            {more ? (
              <button
                type="button"
                className="load-more"
                onClick={() => fetchPage(true).catch(() => {})}
                disabled={loading}
              >
                Load more
              </button>
            ) : null}
            {loading && <div className="popover-loading">Loading…</div>}
          </div>
        </>
      )}
    </div>
  );
}
