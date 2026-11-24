import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { type Issue, messageFor } from '../../../shared/api/index';
import { Button, Notice } from '../../../shared/components/ui/index';
import { uploadAttachment, deleteAttachment } from '../services/attachment.service';

export function AttachmentSection({
  issue,
  owner,
  onUpdated,
}: {
  issue: Issue;
  owner: boolean;
  onUpdated: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const list = issue.attachments || [];

  async function choose(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    if (list.length + files.length > 5) {
      setError(new Error('Only five attachments can be active at once.'));
      return;
    }
    setBusy(true);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        await uploadAttachment(issue.key, file);
      } catch (e) {
        errors.push(`${file.name}: ${messageFor(e)}`);
      }
    }
    setBusy(false);
    onUpdated();
    if (errors.length) setError(new Error(errors.join(' · ')));
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this attachment?')) return;
    setBusy(true);
    try {
      await deleteAttachment(issue.key, id);
      onUpdated();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!list.length && !owner) return null;
  return (
    <section className="detail-section">
      <div className="section-heading">
        <h2>
          Attachments
          <span className="muted">{list.length}/5</span>
        </h2>
        {owner && issue.status !== 'CLOSED' && list.length < 5 && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                choose(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus size={15} /> Add images
            </Button>
          </>
        )}
      </div>
      {list.length > 0 ? (
        <div className="attachment-grid">
          {list.map((a) => (
            <div className="attachment-tile" key={a.id}>
              <a
                href={a.contentUrl}
                target="_blank"
                rel="noreferrer"
                title={`Open ${a.originalName}`}
              >
                <img src={a.contentUrl} alt={a.originalName} loading="lazy" />
                <span>{a.originalName}</span>
              </a>
              {owner && issue.status !== 'CLOSED' && (
                <button
                  aria-label={`Remove ${a.originalName}`}
                  type="button"
                  disabled={busy}
                  onClick={() => remove(a.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No screenshots attached.</p>
      )}
      {error ? <Notice error={error} /> : null}
    </section>
  );
}
