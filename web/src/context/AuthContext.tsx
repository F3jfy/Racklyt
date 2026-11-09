import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { ResourceScope } from '../types';

interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role_id: string;
  permissions: string[];
  scopes: ResourceScope[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<any>;
  verify2FA: (data: { temp_token: string; code: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await ApiClient.me();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('racklyt_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('racklyt_unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const res = await ApiClient.login(credentials);
    if (res.token) {
      ApiClient.setToken(res.token);
      await fetchCurrentUser();
    }
    return res;
  };

  const verify2FA = async (data: { temp_token: string; code: string }) => {
    const res = await ApiClient.verify2FA(data);
    if (res.token) {
      ApiClient.setToken(res.token);
      await fetchCurrentUser();
    }
  };

  const logout = async () => {
    try {
      await ApiClient.logout();
    } catch {}
    ApiClient.clearToken();
    setUser(null);
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    return user.permissions.includes('*') || user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, verify2FA }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
