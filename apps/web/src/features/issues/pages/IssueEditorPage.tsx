import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Trash2, RotateCcw, CheckCircle2, ArrowLeft } from 'lucide-react';
import {
  get,
  mutate,
  newRequestId,
  messageFor,
  queryKeys,
  type Issue,
  type Project,
} from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Button, Field, FormActions, Notice } from '../../../shared/components/ui/index';
import { MarkdownEditor } from '../../../shared/components/markdown/Markdown';
export const issueSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(1).max(10000),
  type: z.enum(['BUG', 'FEATURE', 'TASK']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
export type IssueFields = z.infer<typeof issueSchema>;
export type UploadFile = {
  id: string;
  file: File;
  preview: string;
  status: 'selected' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
};
export function IssueForm({
  issue,
  onSaved,
  onCancel,
}: {
  issue?: Issue;
  onSaved?: (issue: Issue) => void;
  onCancel?: () => void;
}) {
  const { user } = useSession(),
    navigate = useNavigate(),
    [searchParams] = useSearchParams(),
    qc = useQueryClient(),
    isEdit = !!issue;
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => get<Project[]>('/projects'),
    staleTime: 30000,
  });
  const projects = projectsQuery.data || [];
  const defaultProjectSlug = searchParams.get('project') || '';
  const [serverError, setServerError] = useState<unknown>(null),
    [uploads, setUploads] = useState<UploadFile[]>([]),
    [busy, setBusy] = useState(false),
    [createdKey, setCreatedKey] = useState<string | null>(null),
    requestId = useRef(newRequestId());
  const draftKey = `tracker-draft:${user?.id || 'guest'}:${isEdit ? issue.key : 'create'}`;
  const form = useForm<IssueFields>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      projectId: issue?.project?.id || '',
      title: issue?.title || '',
      description: issue?.description || '',
      type: (issue?.type as IssueFields['type']) || 'BUG',
      priority: (issue?.priority as IssueFields['priority']) || 'MEDIUM',
    },
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    setValue,
    reset,
  } = form;
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const data = issueSchema.partial().safeParse(JSON.parse(raw));
        if (data.success)
          for (const [k, v] of Object.entries(data.data))
            setValue(k as keyof IssueFields, v as never);
      }
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    if (isEdit) return;
    const sub = watch((v) => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(v));
      } catch {}
    });
    return () => sub.unsubscribe();
  }, [draftKey, watch, isEdit]);
  const uploadRef = useRef<UploadFile[]>([]);
  useEffect(() => {
    uploadRef.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => {
      uploadRef.current.forEach((f) => URL.revokeObjectURL(f.preview));
    },
    [],
  );
  useEffect(() => {
    if (!isDirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isDirty]);
  useEffect(() => {
    if (isEdit || !projects.length || watch('projectId')) return;
    const match =
      projects.find((p) => p.slug === defaultProjectSlug) ||
      projects.find((p) => p.slug === 'general') ||
      projects[0];
    if (match) form.setValue('projectId', match.id);
  }, [projects, defaultProjectSlug, isEdit]);
  const value = watch('description');
  function choose(files: FileList | null) {
    if (!files) return;
    const added = Array.from(files);
    setServerError(null);
    if (uploads.length + added.length > 5) {
      setServerError(new Error('Maximum five attachments per issue.'));
      return;
    }
    for (const f of added) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) {
        setServerError(new Error('Images must be PNG, JPEG or WebP and no larger than 5 MiB.'));
        return;
      }
    }
    setUploads((p) => [
      ...p,
      ...added.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'selected' as const,
      })),
    ]);
  }
  function remove(id: string) {
    setUploads((p) => {
      const f = p.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return p.filter((x) => x.id !== id);
    });
  }
  async function uploadAll(key: string, files: UploadFile[]) {
    let failed = 0;
    for (const f of files.filter((x) => x.status !== 'uploaded')) {
      setUploads((p) => p.map((x) => (x.id === f.id ? { ...x, status: 'uploading' } : x)));
      const fd = new FormData();
      fd.append('file', f.file);
      try {
        await mutate(`/issues/${key}/attachments`, 'POST', fd);
        setUploads((p) => p.map((x) => (x.id === f.id ? { ...x, status: 'uploaded' } : x)));
      } catch (e) {
        failed++;
        setUploads((p) =>
          p.map((x) => (x.id === f.id ? { ...x, status: 'failed', error: messageFor(e) } : x)),
        );
      }
    }
    return failed;
  }
  async function submit(data: IssueFields) {
    if (!user?.emailVerified) {
      setServerError(new Error('Verify your email to create public content.'));
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      if (isEdit) {
        const updated = await mutate<Issue>(`/issues/${issue.key}`, 'PATCH', {
          ...data,
          projectId: data.projectId || null,
          expectedVersion: issue.version,
        });
        await qc.invalidateQueries({ queryKey: queryKeys.projects });
        reset(data);
        onSaved?.(updated);
        return;
      }
      let key = createdKey;
      if (!key) {
        const saved = await mutate<Issue>('/issues', 'POST', {
          ...data,
          projectId: data.projectId || null,
          clientRequestId: requestId.current,
        });
        key = saved.key;
        setCreatedKey(key);
      }
      const failures = await uploadAll(key, uploads);
      if (!failures) {
        sessionStorage.removeItem(draftKey);
        const chosen = projects.find((p) => p.id === data.projectId);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['issues'] }),
          qc.invalidateQueries({ queryKey: ['board'] }),
          qc.invalidateQueries({ queryKey: queryKeys.projects }),
        ]);
        navigate(chosen ? `/?project=${encodeURIComponent(chosen.slug)}` : '/');
      } else
        setServerError(
          new Error(
            `Issue ${key} was created, but ${failures} attachment(s) failed. Retry only failed uploads, or open the issue.`,
          ),
        );
    } catch (e) {
      setServerError(e);
    } finally {
      setBusy(false);
    }
  }
  async function retryUploads() {
    if (!createdKey) return;
    setBusy(true);
    setServerError(null);
    const failed = await uploadAll(createdKey, uploads);
    setBusy(false);
    if (!failed) {
      sessionStorage.removeItem(draftKey);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['issues'] }),
        qc.invalidateQueries({ queryKey: ['board'] }),
      ]);
      navigate('/');
    } else setServerError(new Error('Some images still failed to upload.'));
  }
  return (
    <div className="issue-form-wrap">
      <form onSubmit={handleSubmit(submit)} noValidate>
        {projects.length > 0 && (
          <Field label="Project">
            <select {...register('projectId')} disabled={busy || !!createdKey}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Title" error={errors.title?.message}>
          <input
            {...register('title')}
            maxLength={150}
            placeholder="A short, specific summary"
            disabled={busy || !!createdKey}
          />
          <span className="field-suffix">{watch('title')?.length || 0}/150</span>
        </Field>

        <div className="form-grid">
          <Field label="Type" error={errors.type?.message}>
            <select {...register('type')} disabled={busy || !!createdKey}>
              <option value="BUG">Bug</option>
              <option value="FEATURE">Feature</option>
              <option value="TASK">Task</option>
            </select>
          </Field>
          <Field label="Priority" error={errors.priority?.message}>
            <select {...register('priority')} disabled={busy || !!createdKey}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </Field>
        </div>

        <div className="form-section">
          <label className="field-label" htmlFor="issue-description">
            Description
          </label>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <MarkdownEditor
                value={field.value}
                onChange={field.onChange}
                error={errors.description?.message}
                disabled={busy || !!createdKey}
              />
            )}
          />
        </div>

        {!isEdit && (
          <div className="form-section">
            <div className="field-label">
              Attachments
              <span className="muted">(optional)</span>
            </div>
            <label className={`file-drop ${createdKey ? 'disabled' : ''}`}>
              <ImagePlus size={18} />
              <span>Choose screenshots</span>
              <small>PNG, JPEG, WebP · up to 5 images · 5 MiB each</small>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={busy || !!createdKey}
                onChange={(e) => {
                  choose(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {uploads.length > 0 && (
              <div className="upload-items">
                {uploads.map((f) => (
                  <div key={f.id} className="upload-item">
                    <img src={f.preview} alt="" />
                    <div className="upload-meta">
                      <strong>{f.file.name}</strong>
                      <small>
                        {(f.file.size / 1024).toFixed(0)} KB ·
                        {f.status === 'uploaded'
                          ? 'Uploaded'
                          : f.status === 'uploading'
                            ? 'Uploading…'
                            : f.status === 'failed'
                              ? `Failed: ${f.error}`
                              : 'Ready'}
                      </small>
                    </div>
                    {f.status === 'uploaded' ? (
                      <CheckCircle2 className="success-text" size={18} />
                    ) : f.status === 'failed' ? (
                      <button
                        type="button"
                        className="icon-button"
                        title="Retry upload"
                        onClick={retryUploads}
                      >
                        <RotateCcw size={17} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${f.file.name}`}
                        disabled={busy || !!createdKey}
                        onClick={() => remove(f.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {serverError ? <Notice error={serverError} /> : null}

        <FormActions>
          {isEdit ? (
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Link className="button button-secondary" to="/">
              Cancel
            </Link>
          )}
          {createdKey ? (
            <>
              <Link to={`/issues/${createdKey}`} className="button button-secondary">
                Open issue
              </Link>
              <Button busy={busy} type="button" onClick={retryUploads}>
                Retry failed uploads
              </Button>
            </>
          ) : (
            <Button busy={busy} type="submit">
              {isEdit ? 'Save changes' : 'Create issue'}
            </Button>
          )}
        </FormActions>
      </form>
    </div>
  );
}
export function CreateIssue() {
  const { user } = useSession();
  return (
    <main className="page narrow-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> All issues
      </Link>
      <div className="page-heading">
        <div>
          <h1>New issue</h1>
          <p>Describe the problem clearly so others can reproduce or understand it.</p>
        </div>
      </div>
      {user?.emailVerified ? (
        <IssueForm />
      ) : (
        <div className="notice">
          Verify your email first.
          <Link to="/verify-email">Go to verification</Link>
        </div>
      )}
    </main>
  );
}
