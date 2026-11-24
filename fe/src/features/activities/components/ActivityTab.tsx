import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { type Issue, type Activity, queryKeys, timeAgo, fullTime } from '../../../shared/api/index';
import { Badge, Empty, LoadingRows, Notice } from '../../../shared/components/ui/index';
import { ActorName } from '../../issues/components/ActorName';
import { fetchActivities } from '../services/activity.service';

export function ActivityTab({ issue }: { issue: Issue }) {
  const q = useInfiniteQuery({
    queryKey: queryKeys.activities(issue.key),
    initialPageParam: '',
    queryFn: ({ pageParam }) => fetchActivities(issue.key, pageParam || null),
    getNextPageParam: (last) => last.meta.nextCursor || undefined,
    staleTime: 30000,
  });
  const activities = q.data?.pages.flatMap((p) => p.data) || [];

  function describe(a: Activity) {
    switch (a.eventType) {
      case 'ISSUE_CREATED':
        return 'created this issue';
      case 'COMMENT_ADDED':
        return 'added a comment';
      case 'STATUS_CHANGED':
        return 'changed status';
      case 'PRIORITY_CHANGED':
        return 'changed priority';
      case 'TYPE_CHANGED':
        return 'changed type';
      default:
        return 'updated the issue';
    }
  }

  return (
    <section className="activity-section">
      <div className="section-heading">
        <h2>Activity</h2>
      </div>
      {q.isPending ? (
        <LoadingRows count={3} />
      ) : q.error ? (
        <Notice error={q.error} />
      ) : activities.length === 0 ? (
        <Empty title="No activity" />
      ) : (
        <ol className="timeline">
          {activities.map((a) => (
            <li key={a.id}>
              <div className="timeline-dot" />
              <div>
                <span className="actor">
                  <ActorName user={a.actor} />
                </span>
                {describe(a)}
                {a.oldValue && a.newValue ? (
                  <div className="activity-change">
                    <Badge
                      value={a.oldValue}
                      kind={
                        a.eventType === 'PRIORITY_CHANGED'
                          ? 'priority'
                          : a.eventType === 'TYPE_CHANGED'
                            ? 'type'
                            : 'status'
                      }
                    />
                    <ArrowRight size={13} />
                    <Badge
                      value={a.newValue}
                      kind={
                        a.eventType === 'PRIORITY_CHANGED'
                          ? 'priority'
                          : a.eventType === 'TYPE_CHANGED'
                            ? 'type'
                            : 'status'
                      }
                    />
                  </div>
                ) : null}
                <div className="muted timeline-date" title={fullTime(a.createdAt)}>
                  {timeAgo(a.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {q.hasNextPage && (
        <button
          className="load-more"
          disabled={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? 'Loading…' : 'Load more activity'}
        </button>
      )}
    </section>
  );
}
