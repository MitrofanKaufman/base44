import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Проверка аутентификации
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.getCurrentUser();
        setUser(currentUser);
        setIsLoadingAuth(false);
      } catch (error) {
        setAuthError(error);
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const value = {
    user,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    navigateToLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};