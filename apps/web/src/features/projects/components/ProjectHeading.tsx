import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { get, mutate, queryKeys, type Project } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Button, Field, Modal, Notice } from '../../../shared/components/ui/index';

const DEFAULT_SUBTITLE = 'Track bugs, features, and tasks across your projects.';

export function ProjectHeading({ activeSlug }: { activeSlug: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => get<Project[]>('/projects'),
    staleTime: 30000,
  });

  const project = activeSlug
    ? (projectsQuery.data || []).find((p) => p.slug === activeSlug)
    : undefined;
  const canManage = !!user?.emailVerified && !!project;

  useEffect(() => {
    if (editOpen && project) {
      setName(project.name);
      setDescription(project.description || '');
    }
  }, [editOpen, project]);

  function closeModals() {
    setEditOpen(false);
    setDeleteOpen(false);
    setError(null);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await mutate<Project>(`/projects/${project.slug}`, 'PATCH', {
        name: name.trim(),
        description: description.trim() || null,
      });
      qc.setQueryData<Project[]>(queryKeys.projects, (old) =>
        (old || []).map((p) => (p.id === updated.id ? updated : p)),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.projects }),
        qc.invalidateQueries({ queryKey: ['issues'] }),
        qc.invalidateQueries({ queryKey: ['board'] }),
      ]);
      closeModals();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await mutate(`/projects/${project.slug}`, 'DELETE');
      qc.setQueryData<Project[]>(queryKeys.projects, (old) =>
        (old || []).filter((p) => p.id !== project.id),
      );
      closeModals();
      navigate('/', { replace: true });
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.projects }),
        qc.invalidateQueries({ queryKey: ['issues'] }),
        qc.invalidateQueries({ queryKey: ['board'] }),
      ]);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="project-heading-title">
        <h1>{project ? project.name : 'Issues'}</h1>
        {canManage && (
          <div className="project-heading-actions">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        )}
      </div>
      <p>{project ? project.description || `Issues in ${project.name}.` : DEFAULT_SUBTITLE}</p>

      <Modal open={editOpen} title="Edit project" onClose={closeModals}>
        <form className="stacked-form" onSubmit={saveProject}>
          <Field label="Project name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              required
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
            <Button type="button" variant="secondary" onClick={closeModals}>
              Cancel
            </Button>
            <Button type="submit" busy={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        title={`Delete project "${project?.name ?? ''}"?`}
        description="Are you sure you want to delete this project? Its issues will not be lost and remain accessible under All projects."
        onClose={closeModals}
      >
        {error ? <Notice error={error} /> : null}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={closeModals}>
            Cancel
          </Button>
          <Button type="button" variant="danger" busy={busy} onClick={deleteProject}>
            <Trash2 size={15} /> Confirm delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
