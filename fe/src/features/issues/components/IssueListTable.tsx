import { Link } from 'react-router-dom';
import { Badge } from '../../../shared/components/ui';
import { timeAgo, type Issue } from '../../../shared/api/index';

/** Compact server-paginated issue table, no data fetching inside rows. */
export function IssueListTable({ issues }: { issues: Issue[] }) {
  return (
    <div className="issue-table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Author</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="issue-cell" to={`/issues/${i.key}`}>
                  <span className="issue-key">
                    {i.key}
                    <span className="issue-type">{i.type.toLowerCase()}</span>
                  </span>
                  <span className="issue-title">{i.title}</span>
                </Link>
              </td>
              <td>
                <Badge value={i.status} />
              </td>
              <td>
                <Badge kind="priority" value={i.priority} />
              </td>
              <td>
                <span className="table-author">
                  {i.author ? `@${i.author.username}` : 'Deleted user'}
                </span>
              </td>
              <td>
                <span title={new Date(i.updatedAt).toLocaleString()} className="table-author">
                  {timeAgo(i.updatedAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
