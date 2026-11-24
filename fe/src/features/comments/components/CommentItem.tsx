import { useState } from 'react';
import { Avatar, Button } from '../../../shared/components/ui';
import { timeAgo, fullTime, type Comment } from '../../../shared/api/index';
import { ActorName } from '../../issues/components/ActorName';

interface CommentItemProps {
  comment: Comment;
  currentUsername?: string;
  issueClosed: boolean;
  onEdit: (comment: Comment, content: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}

/** One discussion comment: isolated edit state, own-author actions and metadata. */
export function CommentItem({
  comment: c,
  currentUsername,
  issueClosed,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.content);
  return (
    <article className="comment" key={c.id}>
      <Avatar user={c.author} />
      <div className="comment-body">
        <div className="comment-top">
          <div>
            <ActorName user={c.author} />
            <span className="comment-date" title={fullTime(c.createdAt)}>
              {timeAgo(c.createdAt)}
              {c.isEdited ? ' · edited' : ''}
            </span>
          </div>
          {currentUsername && c.author?.username === currentUsername && (
            <div className="text-actions">
              {!issueClosed && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditText(c.content);
                  }}
                >
                  Edit
                </button>
              )}
              <button onClick={() => onDelete(c.id)}>Delete</button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="comment-edit">
            <textarea
              rows={3}
              value={editText}
              maxLength={2000}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                disabled={!editText.trim()}
                onClick={() => {
                  void onEdit(c, editText).then((saved) => {
                    if (saved) {
                      setEditing(false);
                    }
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="comment-content">{c.content}</p>
        )}
      </div>
    </article>
  );
}
