import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearAuthStorage,
  deleteUserOfflineData,
  getCurrentUser,
  getStoredToken,
  loginRequest,
  registerRequest,
  storeAuthSession,
  updateCurrentUserProfile,
  USER_KEY,
} from '../services/api.js';
import { startSyncListeners, stopSyncListeners } from '../services/sync.js';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user?.id) {
      clearAuthStorage();
      return null;
    }
    return { ...user, id: String(user.id) };
  } catch {
    clearAuthStorage();
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(() => Boolean(getStoredToken() && !readStoredUser()));

  const acceptSession = useCallback(({ token: nextToken, user: nextUser }) => {
    storeAuthSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    if (user?.id) {
      stopSyncListeners(user.id);
      await deleteUserOfflineData(user.id);
    }
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, [user?.id]);

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
      } catch (error) {
        if (!active) return;
        if ([401, 403].includes(error?.response?.status)) {
          clearAuthStorage();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    validateSession();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !user?.id) return undefined;
    return startSyncListeners(user.id);
  }, [token, user?.id]);

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
