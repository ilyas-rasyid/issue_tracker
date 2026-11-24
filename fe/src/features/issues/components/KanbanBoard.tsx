import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, type Issue, keyValues, statusLabels } from '../../../shared/api/index';
import { useSession } from '../../../app/providers/SessionProvider';
import { Badge, Button, Modal, Notice } from '../../../shared/components/ui/index';
import { updateIssueStatus } from '../services/issue.service';

type BoardColumn = {
  data: Issue[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export function KanbanBoard({
  columns,
  boardRows,
  onLoadMore,
}: {
  columns?: Record<string, BoardColumn>;
  boardRows: Record<string, Issue[]>;
  onLoadMore: (status: string, cursor: string) => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<Issue | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<Issue | null>(null);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<unknown>(null);

  function canMove(from: string, to: string) {
    return (ALLOWED_TRANSITIONS[from] || []).includes(to);
  }

  async function performMove(issue: Issue, nextStatus: string) {
    setMovingKey(issue.key);
    setMoveError(null);
    try {
      await updateIssueStatus(issue.key, nextStatus, issue.version);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['board'] }),
        qc.invalidateQueries({ queryKey: ['issues'] }),
        qc.invalidateQueries({ queryKey: queryKeys.issue(issue.key) }),
      ]);
    } catch (err) {
      setMoveError(err);
    } finally {
      setMovingKey(null);
      setPendingClose(null);
    }
  }

  function handleDragStart(e: React.DragEvent, issue: Issue) {
    setDragging(issue);
    setMoveError(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', issue.key);
  }

  function handleDragEnd() {
    setDragging(null);
    setOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    if (!dragging || dragging.status === status) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = canMove(dragging.status, status) ? 'move' : 'none';
    if (overColumn !== status) setOverColumn(status);
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    const issue = dragging;
    setDragging(null);
    setOverColumn(null);
    if (!issue || issue.status === targetStatus) return;

    if (!canMove(issue.status, targetStatus)) {
      const allowed = (ALLOWED_TRANSITIONS[issue.status] || [])
        .map((s) => statusLabels[s] || s)
        .join(' or ');
      setMoveError(
        new Error(
          `${statusLabels[issue.status] || issue.status} issues can only move to ${allowed}.`,
        ),
      );
      return;
    }

    if (targetStatus === 'CLOSED') {
      setPendingClose(issue);
      return;
    }

    void performMove(issue, targetStatus);
  }

  return (
    <>
      {moveError ? <Notice error={moveError} /> : null}
      <div className="kanban" aria-label="Issues by status">
        {keyValues.map((s) => {
          const items = boardRows[s] || columns?.[s]?.data || [];
          const isOver = overColumn === s && dragging && dragging.status !== s;
          const validDrop = isOver && canMove(dragging.status, s);
          const invalidDrop = isOver && !canMove(dragging.status, s);
          const colClass = [
            'kanban-column',
            validDrop ? 'drop-valid' : '',
            invalidDrop ? 'drop-invalid' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <section
              className={colClass}
              key={s}
              onDragOver={(e) => handleDragOver(e, s)}
              onDragLeave={() => {
                if (overColumn === s) setOverColumn(null);
              }}
              onDrop={(e) => handleDrop(e, s)}
            >
              <div className="kanban-heading">
                <Badge value={s} />
                <span className="column-count">{columns?.[s]?.total || 0}</span>
              </div>
              <div className="kanban-items">
                {items.map((i) => {
                  const isOwner = !!user && i.author?.username === user.username;
                  const itemClass = [
                    'kanban-item',
                    isOwner ? 'is-draggable' : '',
                    dragging?.id === i.id || movingKey === i.key ? 'is-dragging' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <Link
                      to={`/issues/${i.key}`}
                      className={itemClass}
                      key={i.id}
                      draggable={isOwner && !movingKey}
                      onDragStart={isOwner ? (e) => handleDragStart(e, i) : undefined}
                      onDragEnd={isOwner ? handleDragEnd : undefined}
                    >
                      <span className="issue-key">
                        {i.key} · {i.type.toLowerCase()}
                      </span>
                      <strong>{i.title}</strong>
                      <span>
                        <Badge value={i.priority} kind="priority" />
                      </span>
                    </Link>
                  );
                })}
                {!items.length && <p className="column-empty">No issues</p>}
              </div>
              {columns?.[s]?.hasMore && (
                <button
                  className="load-more"
                  onClick={() => onLoadMore(s, columns[s].nextCursor || '')}
                >
                  Load more
                </button>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={!!pendingClose}
        title="Close this issue?"
        description="Closing locks editing, attachments, and new comments until the issue is reopened."
        onClose={() => setPendingClose(null)}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setPendingClose(null)}>
            Cancel
          </Button>
          <Button
            busy={!!movingKey}
            onClick={() => {
              if (pendingClose) void performMove(pendingClose, 'CLOSED');
            }}
          >
            Close issue
          </Button>
        </div>
      </Modal>
    </>
  );
}
