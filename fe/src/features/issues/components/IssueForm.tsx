import { Link } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import { Button, Field, FormActions, Notice } from '../../../shared/components/ui/index';
import { MarkdownEditor } from '../../../shared/components/markdown/Markdown';
import { useIssueEditor } from '../hooks/useIssueEditor';
import type { IssueFormProps } from '../types/issue-form.types';
import { IssueAttachmentPicker } from './IssueAttachmentPicker';

/** Editor presentation only; side effects live in useIssueEditor. */
export function IssueForm({ issue, onSaved, onCancel }: IssueFormProps) {
  const {
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
  } = useIssueEditor({ issue, onSaved, onCancel });
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
          <IssueAttachmentPicker
            uploads={uploads}
            busy={busy}
            createdKey={createdKey}
            choose={choose}
            remove={remove}
            retryUploads={retryUploads}
          />
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
