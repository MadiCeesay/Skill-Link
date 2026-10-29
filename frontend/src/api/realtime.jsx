import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { API_URL, refreshSession } from './client';
const Context = createContext(null);
export function RealtimeProvider({ children }) {
  const { token, user } = useAuth(),
    [active, setActive] = useState(null),
    [status, setStatus] = useState('offline'),
    cache = useQueryClient();
  useEffect(() => {
    if (!token || !active || user?.role === 'ADMIN') return;
    let live = true;
    const socket = io(new URL(API_URL).origin, {
      auth: { token },
      autoConnect: false,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socket.on('connect', () => {
      socket
        .timeout(8000)
        .emit(
          'conversation:join',
          { conversation: active },
          (error, result) => {
            if (!live) return;
            setStatus(!error && result?.success ? 'connected' : 'offline');
            cache.invalidateQueries({
              queryKey: ['api', '/conversations/' + active + '/messages'],
            });
          },
        );
    });
    socket.on('message', (data) => {
      if (data.message?.conversation === active) {
        cache.invalidateQueries({
          queryKey: ['api', '/conversations/' + active + '/messages'],
        });
        cache.invalidateQueries({
          queryKey: ['api', '/notifications/unread-count'],
        });
      }
    });
    socket.on('disconnect', async (reason) => {
      setStatus('offline');
      if (reason === 'io server disconnect') {
        try {
          await refreshSession();
        } catch {
          /* Auth guard handles revoked sessions. */
        }
      }
    });
    socket.on('connect_error', async (error) => {
      setStatus('offline');
      if (error.message === 'Authentication required' && live) {
        try {
          await refreshSession();
        } catch {
          /* Remain on REST/guard. */
        }
      }
    });
    socket.connect();
    return () => {
      live = false;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, active, user?.role, cache]);
  return (
    <Context.Provider value={{ setActive, status }}>
      {children}
    </Context.Provider>
  );
}
export const useRealtime = () => useContext(Context);
