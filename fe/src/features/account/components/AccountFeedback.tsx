import { Check } from 'lucide-react';
import { Notice } from '../../../shared/components/ui';
interface AccountFeedbackProps {
  error: unknown;
  success: string;
}
export function AccountFeedback({ error, success }: AccountFeedbackProps) {
  return (
    <>
      {error ? <Notice error={error} /> : null}
      {success ? (
        <div className="notice notice-success" role="status">
          <Check size={16} />
          {success}
        </div>
      ) : null}
    </>
  );
}
