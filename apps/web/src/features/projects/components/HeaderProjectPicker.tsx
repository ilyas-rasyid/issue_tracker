import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, FolderKanban, Search } from 'lucide-react';
import { get, queryKeys, type Project } from '../../../shared/api/index';

export function HeaderProjectPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSlug = location.pathname === '/' ? params.get('project') || '' : '';

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => get<Project[]>('/projects'),
    staleTime: 30000,
  });

  const projects = projectsQuery.data || [];
  const totalIssues = projects.reduce((sum, p) => sum + p.issueCount, 0);
  const activeProject = projects.find((p) => p.slug === activeSlug);
  const term = query.trim().toLowerCase();
  const filtered = term
    ? projects.filter(
        (p) => p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term),
      )
    : projects;

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function selectProject(slug: string) {
    setOpen(false);
    const next = new URLSearchParams(location.pathname === '/' ? params : '');
    if (slug) next.set('project', slug);
    else next.delete('project');
    next.delete('page');
    for (const k of [...next.keys()]) if (k.startsWith('cursor')) next.delete(k);
    const qs = next.toString();
    navigate(qs ? `/?${qs}` : '/');
  }

  return (
    <div className="project-picker">
      <button
        type="button"
        className="project-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select project"
      >
        <FolderKanban size={15} />
        <span className="project-picker-label">
          {activeProject ? activeProject.name : 'All projects'}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="popover-dismiss"
            aria-label="Close project selector"
            onClick={() => setOpen(false)}
          />
          <div className="project-picker-menu" role="listbox" aria-label="Projects">
            <div className="project-picker-search">
              <Search size={14} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
              />
            </div>

            <div className="project-picker-list">
              {!term && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeSlug}
                  className={`project-picker-option${!activeSlug ? ' active' : ''}`}
                  onClick={() => selectProject('')}
                >
                  <span className="project-picker-name">All projects</span>
                  <span className="project-picker-meta">
                    <span className="project-count">{totalIssues}</span>
                    {!activeSlug && <Check size={14} />}
                  </span>
                </button>
              )}

              {filtered.map((p) => {
                const selected = activeSlug === p.slug;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`project-picker-option${selected ? ' active' : ''}`}
                    onClick={() => selectProject(p.slug)}
                  >
                    <span className="project-picker-name">{p.name}</span>
                    <span className="project-picker-meta">
                      <span className="project-count">{p.issueCount}</span>
                      {selected && <Check size={14} />}
                    </span>
                  </button>
                );
              })}

              {!filtered.length && <div className="project-picker-empty">No matching projects</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

