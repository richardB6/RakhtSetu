'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { IUser, UserRole } from '@/types';

interface AuthContextType {
  user: IUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: UserRole;
    profile: Record<string, unknown>;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUser(data.data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch {
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const register = async (regData: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: UserRole;
    profile: Record<string, unknown>;
  }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch {
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
