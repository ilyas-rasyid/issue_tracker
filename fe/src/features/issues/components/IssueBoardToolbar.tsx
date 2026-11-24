import type { Dispatch, SetStateAction } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { keyValues, priorityLabels, queryKeys, statusLabels } from '../../../shared/api/index';
import { fetchProjects } from '../../projects/services/project.service';
import { sortOptions } from '../constants/issue-sort-options';

interface IssueBoardToolbarProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  params: URLSearchParams;
  update: (key: string, value: string) => void;
}

export function IssueBoardToolbar({ search, setSearch, params, update }: IssueBoardToolbarProps) {
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => fetchProjects(),
    staleTime: 30000,
  });
  const projects = projectsQuery.data || [];

  return (
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
          aria-label="Filter project"
          value={params.get('project') || ''}
          onChange={(e) => update('project', e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option value={p.slug} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
  );
}
