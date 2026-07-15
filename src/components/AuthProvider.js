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
    const init = async () => {
      try {
        const cookie = document.cookie.split('; ').find((c) => c.startsWith('nexus_user='));
        if (cookie) {
          const value = decodeURIComponent(cookie.split('=')[1]);
          const parsed = JSON.parse(value);
          if (parsed && parsed.email) {
            setUser(parsed);
            localStorage.setItem('nexus_user', JSON.stringify(parsed));
            setIsHydrated(true);
            return;
          }
        }
      } catch {}

      // No valid cookie found — clear any stale localStorage to prevent ghost sessions
      const stored = localStorage.getItem('nexus_user');
      if (stored) {
        // Cookie is gone but localStorage still has user data — this causes the redirect loop
        // Clear it so the user stays on the login page cleanly
        localStorage.removeItem('nexus_user');
        localStorage.removeItem('nexus_active_job');
      }
      setIsHydrated(true);
    };
    init();
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

  const login = useCallback(async (email, password, role, fullUser) => {
    // If password starts with 'temp-' marker, it's a PIN-authenticated user (skip DB)
    if (password && password.startsWith('temp-')) {
      const authenticated = fullUser
        ? { ...fullUser, source: 'pin' }
        : { email, role, source: 'pin' };
      setUser(authenticated);
      localStorage.setItem('nexus_user', JSON.stringify(authenticated));
      document.cookie = `nexus_user=${encodeURIComponent(JSON.stringify(authenticated))}; path=/; max-age=${7 * 24 * 60 * 60};`;
      router.push(role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
      return authenticated;
    }
    const { user: authenticated } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    setUser(authenticated);
    localStorage.setItem('nexus_user', JSON.stringify(authenticated));
    router.push(role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
    return authenticated;
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_active_job');
    document.cookie = 'nexus_user=; path=/; max-age=0';
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isHydrated }}>
      {isHydrated ? children : null}
    </AuthContext.Provider>
  );
}
