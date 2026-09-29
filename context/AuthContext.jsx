'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
} from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await getMe();
      if (!mountedRef.current) return null;
      const nextUser = data && data.user ? data.user : null;
      setUser(nextUser);
      setStatus('ready');
      return nextUser;
    } catch (err) {
      // The API may be unavailable (network error, cold start, TLS). The UI
      // must still render, so treat that as "signed out but ready".
      if (!mountedRef.current) return null;
      setUser(null);
      setStatus('ready');
      return null;
    }
  }, []);

  useEffect(() => {
    // Runtime only — never during render, never at module scope.
    refresh();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const data = await apiLogin(credentials);
    const nextUser = data && data.user ? data.user : null;
    if (mountedRef.current) {
      setUser(nextUser);
      setStatus('ready');
    }
    return nextUser;
  }, []);

  const signup = useCallback(async (details) => {
    const data = await apiSignup(details);
    const nextUser = data && data.user ? data.user : null;
    if (mountedRef.current) {
      setUser(nextUser);
      setStatus('ready');
    }
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      // Even if the request fails we clear the local session state.
    }
    if (mountedRef.current) {
      setUser(null);
      setStatus('ready');
    }
    return true;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      loading: status === 'idle' || status === 'loading',
      signup,
      login,
      logout,
      refresh,
    }),
    [user, status, signup, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

export default AuthContext;