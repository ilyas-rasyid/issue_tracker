import { Button } from '../../../shared/components/ui';
import type { Page } from '../../../shared/api/index';

interface IssueListPaginationProps {
  meta: Page<unknown>['meta'];
  limit: string;
  update: (key: string, value: string) => void;
}

export function IssueListPagination({ meta, limit, update }: IssueListPaginationProps) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <div>
        <span className="muted">Rows per page</span>
        <select
          aria-label="Rows per page"
          value={limit}
          onChange={(e) => update('limit', e.target.value)}
        >
          {[10, 20, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="pagination-actions">
        <Button
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => update('page', String(meta.page - 1))}
        >
          Previous
        </Button>
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={meta.page >= meta.totalPages}
          onClick={() => update('page', String(meta.page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
