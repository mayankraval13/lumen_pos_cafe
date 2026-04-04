import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useGetMe, User } from '@workspace/api-client-react';
import { getToken, setToken, clearToken } from '../lib/authToken';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (isError) {
      clearToken();
      setTokenState(null);
      queryClient.clear();
      setLocation('/login');
    }
  }, [isError, setLocation, queryClient]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setTokenState(newToken);
    queryClient.setQueryData(['/api/auth/me'], newUser);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    queryClient.clear();
    setLocation('/login');
  };

  const value = {
    token,
    user: user || null,
    isLoading: isUserLoading && !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
