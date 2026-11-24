import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
export function MarkdownEditor({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div className={`markdown-editor ${error ? 'has-error' : ''}`}>
      <div className="editor-tabs" role="tablist" aria-label="Markdown editor">
        <button
          role="tab"
          aria-selected={tab === 'write'}
          type="button"
          onClick={() => setTab('write')}
          className={tab === 'write' ? 'active' : ''}
        >
          Write
        </button>
        <button
          role="tab"
          aria-selected={tab === 'preview'}
          type="button"
          onClick={() => setTab('preview')}
          className={tab === 'preview' ? 'active' : ''}
        >
          Preview
        </button>
        <span className="editor-count">{value.length.toLocaleString()} / 10,000</span>
      </div>

      {tab === 'write' ? (
        <textarea
          id="issue-description"
          aria-label="Issue description"
          disabled={disabled}
          rows={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe the issue, steps to reproduce, and expected behavior. Markdown is supported."
        />
      ) : (
        <div className="markdown-preview">
          {value ? (
            <Markdown>{value}</Markdown>
          ) : (
            <span className="muted">Nothing to preview.</span>
          )}
        </div>
      )}

      {error ? (
        <div className="field-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="editor-footer">
        GitHub Flavored Markdown · Code blocks, tables, checklists
      </div>
    </div>
  );
}
