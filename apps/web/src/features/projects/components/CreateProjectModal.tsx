import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { mutate, queryKeys, type Project } from '../../../shared/api/index';
import { Button, Field, Modal, Notice } from '../../../shared/components/ui/index';

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
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
      onClose();
      navigate(`/?project=${encodeURIComponent(created.slug)}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create new project"
      description="Group related issues under their own project board."
      onClose={close}
    >
      <form className="stacked-form" onSubmit={submit}>
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
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

