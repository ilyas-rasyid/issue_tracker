import { ImagePlus, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { UploadFile } from '../types/issue-attachment.types';

export interface IssueAttachmentPickerProps {
  uploads: UploadFile[];
  busy: boolean;
  createdKey: string | null;
  choose: (files: FileList | null) => void;
  remove: (id: string) => void;
  retryUploads: () => Promise<void>;
}

/** File selection, previews and per-file feedback; uploads are owned by the editor hook. */
export function IssueAttachmentPicker({
  uploads,
  busy,
  createdKey,
  choose,
  remove,
  retryUploads,
}: IssueAttachmentPickerProps) {
  return (
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
  );
}
