import { QueryClient } from '@tanstack/react-query';
export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (fail, e) =>
        fail <= 2 &&
        !(
          e instanceof Error &&
          'status' in e &&
          typeof (e as any).status === 'number' &&
          ![500, 502, 503, 504].includes((e as any).status)
        ),
      retryDelay: (i) => Math.min(1000 * 2 ** i, 8000),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
