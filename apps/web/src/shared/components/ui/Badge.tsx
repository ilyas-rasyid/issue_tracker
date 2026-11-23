import { statusLabels, priorityLabels } from '../../api/index';
export function Badge({
  value,
  kind = 'status',
}: {
  value: string;
  kind?: 'status' | 'priority' | 'type';
}) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      <span className="badge-dot" aria-hidden="true" />
      {kind === 'status'
        ? statusLabels[value] || value
        : kind === 'priority'
          ? priorityLabels[value] || value
          : value.toLowerCase()}
    </span>
  );
}
