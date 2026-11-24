import { AlertCircle } from 'lucide-react';
import { messageFor } from '../../api/index';
export function Notice({ error }: { error: unknown }) {
  return (
    <div className="notice notice-error" role="alert">
      <AlertCircle size={16} />
      {messageFor(error)}
    </div>
  );
}
