import React from 'react';
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {detail && <p className="muted">{detail}</p>}
      {action}
    </div>
  );
}
