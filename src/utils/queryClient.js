import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't refetch on window focus by default
      staleTime: 1000 * 60 * 5, // 5 minutes stale time
      retry: 1, // Retry once on failure
    },
  },
});
