import {
  createContext,
  useContext,
  useSyncExternalStore,
  useEffect,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, session } from './client';
import { homeFor } from '../utils/policy';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const value = useSyncExternalStore(
      session.subscribe,
      session.get,
      () => null,
    ),
    cache = useQueryClient();
  useEffect(() => {
    if (!value) cache.clear();
  }, [value, cache]);
  const login = async (input) => {
    const data = await api('/auth/login', { method: 'POST', body: input });
    cache.clear();
    session.set(data);
    return data.user;
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      session.clear();
      cache.clear();
    }
  };
  return (
    <AuthContext.Provider
      value={{ user: value?.user, token: value?.accessToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function Guard({ roles, children }) {
  const { user } = useAuth(),
    location = useLocation();
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (roles && !roles.includes(user.role))
    return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
