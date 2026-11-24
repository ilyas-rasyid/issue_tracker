import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newRequestId, messageFor, queryKeys } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { issueSchema, type IssueFields } from '../schemas/issue.schema';
import type { UploadFile } from '../types/issue-attachment.types';
import type { IssueFormProps } from '../types/issue-form.types';
import { fetchProjects } from '../../projects/services/project.service';
import { uploadAttachment } from '../../attachments/services/attachment.service';
import { createIssue, updateIssue } from '../services/issue.service';

/** Owns draft recovery, form state, create/update and resumable attachment uploads. */
export function useIssueEditor({ issue, onSaved }: IssueFormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isEdit = !!issue;

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => fetchProjects(),
    staleTime: 30000,
  });
  const projects = projectsQuery.data || [];
  const defaultProjectSlug = searchParams.get('project') || '';
  const [serverError, setServerError] = useState<unknown>(null);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const requestId = useRef(newRequestId());
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
    if (isEdit) {
      return;
    }
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const data = issueSchema.partial().safeParse(JSON.parse(raw));
        if (data.success) {
          for (const [k, v] of Object.entries(data.data)) {
            setValue(k as keyof IssueFields, v as never);
          }
        }
      }
    } catch {
      // Best-effort operation
    }
  }, [draftKey]);

  useEffect(() => {
    if (isEdit) {
      return;
    }
    const sub = watch((v) => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(v));
      } catch {
        // Best-effort operation
      }
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
    if (!isDirty) {
      return;
    }
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isDirty]);

  useEffect(() => {
    if (isEdit || !projects.length || watch('projectId')) {
      return;
    }
    const match =
      projects.find((p) => p.slug === defaultProjectSlug) ||
      projects.find((p) => p.slug === 'general') ||
      projects[0];
    if (match) {
      form.setValue('projectId', match.id);
    }
  }, [projects, defaultProjectSlug, isEdit]);

  function choose(files: FileList | null) {
    if (!files) {
      return;
    }
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
      if (f) {
        URL.revokeObjectURL(f.preview);
      }
      return p.filter((x) => x.id !== id);
    });
  }

  async function uploadAll(key: string, files: UploadFile[]) {
    let failed = 0;
    for (const f of files.filter((x) => x.status !== 'uploaded')) {
      setUploads((p) => p.map((x) => (x.id === f.id ? { ...x, status: 'uploading' } : x)));
      try {
        await uploadAttachment(key, f.file);
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
        const updated = await updateIssue(issue.key, {
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
        const saved = await createIssue({
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
      } else {
        setServerError(
          new Error(
            `Issue ${key} was created, but ${failures} attachment(s) failed. Retry only failed uploads, or open the issue.`,
          ),
        );
      }
    } catch (e) {
      setServerError(e);
    } finally {
      setBusy(false);
    }
  }

  async function retryUploads() {
    if (!createdKey) {
      return;
    }
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
    } else {
      setServerError(new Error('Some images still failed to upload.'));
    }
  }

  return {
    user,
    projects,
    isEdit,
    register,
    control,
    handleSubmit,
    watch,
    errors,
    uploads,
    busy,
    createdKey,
    serverError,
    choose,
    remove,
    submit,
    retryUploads,
  };
}
