"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: () => {},
  isHydrated: false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('nexus_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('nexus_user');
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!user && pathname !== '/') {
      router.push('/');
    } else if (user) {
      if (user.role === 'EMPLOYEE' && pathname.startsWith('/admin')) {
        router.push('/dashboard');
      } else if (pathname === '/') {
        router.push(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
      }
    }
  }, [user, pathname, isHydrated, router]);

  const login = useCallback(async (email, password, role) => {
    const { user: authenticated } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    setUser(authenticated);
    localStorage.setItem('nexus_user', JSON.stringify(authenticated));
    router.push(role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
    return authenticated;
  }, [router]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_active_job');
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isHydrated }}>
      {isHydrated ? children : null}
    </AuthContext.Provider>
  );
}
