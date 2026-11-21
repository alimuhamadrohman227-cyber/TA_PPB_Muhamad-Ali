import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearAuthStorage,
  getCurrentUser,
  getStoredToken,
  loginRequest,
  registerRequest,
  storeAuthSession,
  updateCurrentUserProfile,
  USER_KEY,
} from '../services/api.js';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearAuthStorage();
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  const acceptSession = useCallback(({ token: nextToken, user: nextUser }) => {
    storeAuthSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const validateSession = async () => {
      if (!token) {
        clearAuthStorage();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const currentUser = await getCurrentUser();
        if (!active) return;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        if (!active) return;
        clearAuthStorage();
        setToken(null);
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    validateSession();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    acceptSession(await loginRequest(credentials));
  }, [acceptSession]);

  const register = useCallback(async (credentials) => {
    acceptSession(await registerRequest(credentials));
  }, [acceptSession]);

  const updateProfile = useCallback(async (profile) => {
    const updatedUser = await updateCurrentUserProfile(profile);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    updateProfile,
  }), [token, user, loading, login, register, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
