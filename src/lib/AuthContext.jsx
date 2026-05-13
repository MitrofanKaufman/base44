import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BackgroundSyncService } from '@/lib/BackgroundSyncService';
import { startActivityHeartbeat, stopActivityHeartbeat } from '@/lib/activityHeartbeat';
import { initializeSubscriptions } from '@/lib/initSubscriptions';

const AuthContext = createContext(null);

function isAdminUser(user) {
  return ['admin', 'administrator', 'owner'].includes(user?.role);
}

function replaceBrowserPath(path) {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, document.title, path);
  window.dispatchEvent(new Event('popstate'));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  const applyAuthenticatedUser = useCallback((currentUser) => {
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);

    BackgroundSyncService.stop();
    BackgroundSyncService.start();
    startActivityHeartbeat();

    if (isAdminUser(currentUser)) {
      initializeSubscriptions().catch((error) => {
        console.error('Subscription initialization failed:', error);
      });
    }
  }, []);

  const checkUserAuth = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingAuth(true);
    }

    try {
      const currentUser = await base44.auth.me();
      applyAuthenticatedUser(currentUser);
      return currentUser;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({
        type: 'auth_required',
        message: error?.status === 401
          ? 'Сессия истекла. Войдите заново.'
          : error?.message || 'Требуется авторизация',
      });
      setIsLoadingAuth(false);
      BackgroundSyncService.stop();
      stopActivityHeartbeat();
      return null;
    }
  }, [applyAuthenticatedUser]);

  useEffect(() => {
    checkUserAuth({ silent: true });

    return () => {
      BackgroundSyncService.stop();
      stopActivityHeartbeat();
    };
  }, [checkUserAuth]);

  const login = useCallback(async ({ email, password }) => {
    setAuthError(null);
    const { user: loggedInUser } = await base44.auth.loginViaEmailPassword(email, password);
    applyAuthenticatedUser(loggedInUser || await base44.auth.me());
  }, [applyAuthenticatedUser]);

  const register = useCallback(async ({ email, fullName, password }) => {
    setAuthError(null);
    const { user: registeredUser } = await base44.auth.register({
      email,
      full_name: fullName,
      password,
    });
    applyAuthenticatedUser(registeredUser || await base44.auth.me());
  }, [applyAuthenticatedUser]);

  const logout = useCallback(async (shouldRedirect = true) => {
    try {
      await base44.auth.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError(null);
      setIsLoadingAuth(false);
      BackgroundSyncService.stop();
      stopActivityHeartbeat();

      if (shouldRedirect) {
        replaceBrowserPath('/login');
      }
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    replaceBrowserPath('/login');
  }, []);

  const checkAppState = checkUserAuth;

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    appPublicSettings,
    authChecked,
    login,
    register,
    logout,
    navigateToLogin,
    checkUserAuth,
    checkAppState,
  }), [
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    appPublicSettings,
    authChecked,
    login,
    register,
    logout,
    navigateToLogin,
    checkUserAuth,
    checkAppState,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
