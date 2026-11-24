import { QueryClient } from '@tanstack/react-query';
export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount > 2) {
          return false;
        }

        if (error instanceof Error && 'status' in error) {
          const status = (error as Error & { status?: number }).status;
          return status === undefined || [500, 502, 503, 504].includes(status);
        }

        return true;
      },
      retryDelay: (i) => Math.min(1000 * 2 ** i, 8000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
