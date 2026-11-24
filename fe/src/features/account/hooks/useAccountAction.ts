import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../app/providers/SessionProvider';
/** Shared mutation feedback for account forms (each section has independent state). */
export function useAccountAction() {
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');
  async function run(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]);
      await refresh();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    success,
    run,
  };
}
