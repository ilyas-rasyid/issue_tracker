import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import { get, mutate, queryKeys, type Project } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Button, Field, Modal, Notice } from '../../../shared/components/ui/index';

export function ProjectBar({
  activeSlug,
  onSelect,
}: {
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => get<Project[]>('/projects'),
    staleTime: 30000,
  });

  const projects = projectsQuery.data || [];
  const totalIssues = projects.reduce((sum, p) => sum + p.issueCount, 0);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await mutate<Project>('/projects', 'POST', {
        name: name.trim(),
        description: description.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: queryKeys.projects });
      setName('');
      setDescription('');
      setOpen(false);
      onSelect(created.slug);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="project-bar" aria-label="Projects">
      <div className="project-list" role="tablist" aria-label="Filter by project">
        <button
          type="button"
          role="tab"
          aria-selected={!activeSlug}
          className={`project-pill${!activeSlug ? ' active' : ''}`}
          onClick={() => onSelect('')}
        >
          <FolderKanban size={14} />
          <span>All projects</span>
          <span className="project-count">{totalIssues}</span>
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activeSlug === p.slug}
            className={`project-pill${activeSlug === p.slug ? ' active' : ''}`}
            onClick={() => onSelect(p.slug)}
            title={p.description || p.name}
          >
            <span>{p.name}</span>
            <span className="project-count">{p.issueCount}</span>
          </button>
        ))}
      </div>

      {user?.emailVerified ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Plus size={14} /> New project
        </Button>
      ) : null}

      <Modal
        open={open}
        title="Create new project"
        description="Group related issues under their own project board."
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
      >
        <form className="stacked-form" onSubmit={createProject}>
          <Field label="Project name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
              placeholder="e.g. Mobile App, Billing API"
            />
          </Field>
          <Field label="Description (optional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="Short summary of what this project tracks"
            />
          </Field>
          {error ? <Notice error={error} /> : null}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" busy={busy}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
