import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APIError, get, queryKeys, cleanPrivateSession } from '../../shared/api/index';
export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
};
export const Ctx = createContext<{
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<unknown>;
  logoutLocal: () => void;
}>({ user: null, loading: true, refresh: async () => {}, logoutLocal: () => {} });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.auth,
    queryFn: async () => {
      try {
        return await get<SessionUser>('/auth/me');
      } catch (e) {
        if (e instanceof APIError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60000,
    retry: false,
  });
  const logoutLocal = () => {
    cleanPrivateSession();
    qc.clear();
    qc.setQueryData(queryKeys.auth, null);
  };
  useEffect(() => {
    const channel = new BroadcastChannel('issuetrack-auth');
    channel.onmessage = (e) => {
      if (e.data === 'logout') logoutLocal();
      else if (e.data === 'change') qc.invalidateQueries({ queryKey: queryKeys.auth });
    };
    return () => channel.close();
  }, [qc]);
  return (
    <Ctx.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        refresh: () => qc.invalidateQueries({ queryKey: queryKeys.auth }),
        logoutLocal,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export const useSession = () => useContext(Ctx);
export const broadcastAuth = (message: 'logout' | 'change') => {
  try {
    const c = new BroadcastChannel('issuetrack-auth');
    c.postMessage(message);
    c.close();
  } catch {
    // Best-effort operation; failure is handled by the surrounding flow.
  }
};
