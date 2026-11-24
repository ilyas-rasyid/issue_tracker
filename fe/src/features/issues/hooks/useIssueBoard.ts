import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, type Issue, keyValues } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { fetchIssues, fetchIssueBoard } from '../services/issue.service';

/** URL-owned filters, view preferences and server-driven board/list data. */
export function useIssueBoard() {
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
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
      if (search.trim() === next) {
        return;
      }
      setParams((p) => {
        const n = new URLSearchParams(p);
        if (search.trim()) {
          n.set('search', search.trim());
        } else {
          n.delete('search');
        }
        n.delete('page');
        for (const k of [...n.keys()]) {
          if (k.startsWith('cursor')) {
            n.delete(k);
          }
        }
        return n;
      });
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  function update(key: string, value: string) {
    setParams((old) => {
      const n = new URLSearchParams(old);
      if (value) {
        n.set(key, value);
      } else {
        n.delete(key);
      }
      if (key !== 'page' && !key.startsWith('cursor')) {
        n.delete('page');
        for (const k of [...n.keys()]) {
          if (k.startsWith('cursor')) {
            n.delete(k);
          }
        }
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
    queryFn: () => fetchIssues(query),
    staleTime: 30000,
    enabled: view === 'list',
  });

  const board = useQuery({
    queryKey: queryKeys.board(query),
    queryFn: () => fetchIssueBoard(query),
    staleTime: 30000,
    enabled: view === 'board',
  });

  const data = list.data;
  const columns = board.data?.data.columns;
  const filterSignature = [...params]
    .filter(([k]) => !k.startsWith('cursor'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map((x) => x.join('='))
    .join('&');

  useEffect(() => {
    setBoardRows({});
  }, [filterSignature]);

  useEffect(() => {
    if (!columns) {
      return;
    }
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
      if (p.get('view')) {
        n.set('view', p.get('view')!);
      }
      if (p.get('project')) {
        n.set('project', p.get('project')!);
      }
      return n;
    });
    setSearch('');
  }

  return {
    params,
    user,
    view,
    search,
    setSearch,
    setView,
    update,
    clear,
    hasFilters,
    activeProject,
    list,
    board,
    data,
    columns,
    boardRows,
  };
}
