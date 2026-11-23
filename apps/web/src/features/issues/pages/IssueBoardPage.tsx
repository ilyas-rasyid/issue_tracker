import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, List as ListIcon, Columns3, Plus } from 'lucide-react';
import {
  api,
  queryKeys,
  type Issue,
  type Page,
  statusLabels,
  priorityLabels,
  keyValues,
  timeAgo,
} from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Badge, Button, Empty, LoadingRows, Notice } from '../../../shared/components/ui/index';
import { KanbanBoard } from '../components/KanbanBoard';
export const sortOptions = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['updated', 'Recently updated'],
  ['priority_desc', 'Priority: high to low'],
  ['priority_asc', 'Priority: low to high'],
];
export function Board() {
  const [params, setParams] = useSearchParams(),
    { user } = useSession();
  const query = params.toString();
  const viewOverride = params.get('view');
  const [preferred, setPreferred] = useState<'list' | 'board'>(() =>
    localStorage.getItem('tracker-view') === 'board' ? 'board' : 'list',
  );
  const view = viewOverride === 'board' || viewOverride === 'list' ? viewOverride : preferred;
  const [search, setSearch] = useState(params.get('search') || '');
  const [boardRows, setBoardRows] = useState<Record<string, Issue[]>>({});
  useEffect(() => setSearch(params.get('search') || ''), [params.get('search')]);
  useEffect(() => {
    const id = setTimeout(() => {
      const next = params.get('search') || '';
      if (search.trim() === next) return;
      setParams((p) => {
        const n = new URLSearchParams(p);
        search.trim() ? n.set('search', search.trim()) : n.delete('search');
        n.delete('page');
        for (const k of [...n.keys()]) if (k.startsWith('cursor')) n.delete(k);
        return n;
      });
    }, 350);
    return () => clearTimeout(id);
  }, [search]);
  function update(key: string, value: string) {
    setParams((old) => {
      const n = new URLSearchParams(old);
      value ? n.set(key, value) : n.delete(key);
      if (key !== 'page' && !key.startsWith('cursor')) {
        n.delete('page');
        for (const k of [...n.keys()]) if (k.startsWith('cursor')) n.delete(k);
      }
      return n;
    });
  }
  function setView(next: 'list' | 'board') {
    localStorage.setItem('tracker-view', next);
    setPreferred(next);
    update('view', next);
  }
  const list = useQuery({
    queryKey: queryKeys.issues(query),
    queryFn: () => api<Page<Issue>>(`/issues?${query}`),
    staleTime: 30000,
    enabled: view === 'list',
  });
  const board = useQuery({
    queryKey: queryKeys.board(query),
    queryFn: () =>
      api<{
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
      }>(`/issues/board?${query}`),
    staleTime: 30000,
    enabled: view === 'board',
  });
  const data = list.data,
    columns = board.data?.data.columns;
  const filterSignature = [...params]
    .filter(([k]) => !k.startsWith('cursor'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map((x) => x.join('='))
    .join('&');
  useEffect(() => {
    setBoardRows({});
  }, [filterSignature]);
  useEffect(() => {
    if (!columns) return;
    setBoardRows((prev) => {
      const out: Record<string, Issue[]> = {};
      for (const s of keyValues) {
        const current = columns[s]?.data || [];
        const hadCursor = !!params.get(`cursor${s}`);
        const combined = hadCursor ? [...(prev[s] || []), ...current] : current;
        out[s] = [...new Map(combined.map((i): [string, Issue] => [i.id, i])).values()];
      }
      return out;
    });
  }, [board.data]);
  const hasFilters = ['search', 'status', 'type', 'priority', 'mine', 'author'].some((k) =>
    params.has(k),
  );
  const activeProject = params.get('project') || '';
  function clear() {
    setParams((p) => {
      const n = new URLSearchParams();
      if (p.get('view')) n.set('view', p.get('view')!);
      if (p.get('project')) n.set('project', p.get('project')!);
      return n;
    });
    setSearch('');
  }
  return (
    <div className="page board-page">
      <div className="page-heading">
        <div>
          <h1>Issues</h1>
          <p>Track bugs, features, and tasks across your projects.</p>
        </div>
        {user?.emailVerified ? (
          <Link
            className="button button-primary"
            to={
              activeProject
                ? `/issues/new?project=${encodeURIComponent(activeProject)}`
                : '/issues/new'
            }
          >
            <Plus size={16} /> New issue
          </Link>
        ) : null}
      </div>

      <div className="issue-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search issues"
            placeholder="Search title or issue key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              ×
            </button>
          )}
        </label>

        <div className="filter-row">
          <select
            aria-label="Filter status"
            value={params.get('status') || ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {keyValues.map((s) => (
              <option value={s} key={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter type"
            value={params.get('type') || ''}
            onChange={(e) => update('type', e.target.value)}
          >
            <option value="">All types</option>
            {['BUG', 'FEATURE', 'TASK'].map((s) => (
              <option value={s} key={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter priority"
            value={params.get('priority') || ''}
            onChange={(e) => update('priority', e.target.value)}
          >
            <option value="">All priorities</option>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
              <option value={s} key={s}>
                {priorityLabels[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort issues"
            value={params.get('sort') || 'newest'}
            onChange={(e) => update('sort', e.target.value)}
          >
            {sortOptions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="board-controls">
        <div className="board-context">
          {view === 'list' && data ? (
            <>
              <strong>{data.meta.total.toLocaleString()}</strong> issues
            </>
          ) : (
            <>Issue board</>
          )}
          {user && (
            <label className="mine-filter">
              <input
                type="checkbox"
                checked={params.get('mine') === 'true'}
                onChange={(e) => update('mine', e.target.checked ? 'true' : '')}
              />{' '}
              Created by me
            </label>
          )}
          {hasFilters && (
            <button className="text-button" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
        <div className="view-switch" role="group" aria-label="Issue view">
          <button onClick={() => setView('list')} aria-pressed={view === 'list'}>
            <ListIcon size={16} /> List
          </button>
          <button onClick={() => setView('board')} aria-pressed={view === 'board'}>
            <Columns3 size={16} /> Board
          </button>
        </div>
      </div>

      {view === 'list' ? (
        list.isPending ? (
          <LoadingRows count={8} />
        ) : list.error ? (
          <Notice error={list.error} />
        ) : data?.data.length ? (
          <div className="issue-table-wrap">
            <table className="issue-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Author</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="issue-cell" to={`/issues/${i.key}`}>
                        <span className="issue-key">
                          {i.key}
                          <span className="issue-type">{i.type.toLowerCase()}</span>
                        </span>
                        <span className="issue-title">{i.title}</span>
                      </Link>
                    </td>
                    <td>
                      <Badge value={i.status} />
                    </td>
                    <td>
                      <Badge kind="priority" value={i.priority} />
                    </td>
                    <td>
                      <span className="table-author">
                        {i.author ? `@${i.author.username}` : 'Deleted user'}
                      </span>
                    </td>
                    <td>
                      <span title={new Date(i.updatedAt).toLocaleString()} className="table-author">
                        {timeAgo(i.updatedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching issues"
            detail={
              hasFilters
                ? 'Try clearing your filters or changing your search.'
                : 'No issues have been reported yet.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        )
      ) : board.isPending ? (
        <LoadingRows />
      ) : board.error ? (
        <Notice error={board.error} />
      ) : (
        <KanbanBoard
          columns={columns}
          boardRows={boardRows}
          onLoadMore={(status, cursor) => update(`cursor${status}`, cursor)}
        />
      )}

      {view === 'list' && data && data.meta.totalPages > 1 && (
        <div className="pagination">
          <div>
            <span className="muted">Rows per page</span>
            <select
              aria-label="Rows per page"
              value={params.get('limit') || '10'}
              onChange={(e) => update('limit', e.target.value)}
            >
              {[10, 20, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="pagination-actions">
            <Button
              variant="secondary"
              disabled={data.meta.page <= 1}
              onClick={() => update('page', String(data.meta.page - 1))}
            >
              Previous
            </Button>
            <span>
              Page {data.meta.page} of {data.meta.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => update('page', String(data.meta.page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
