'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, restoreSession, setFormatPrefs, tokens } from './api';

export type Admin = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { id: string; name: string; slug: string; permissions: string[] } | null;
};

type AuthState = {
  admin: Admin | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!tokens.access && !(await restoreSession())) {
        setLoading(false);
        return;
      }
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const res = await api.get<{
            data: {
              admin: Admin;
              permissions: string[];
              organization?: { baseCurrency: string; timezone: string } | null;
            };
          }>('/auth/admin/me');
          setFormatPrefs(res.data.organization);
          setAdmin(res.data.admin);
          setPermissions(res.data.permissions ?? []);
          break;
        } catch (err) {
          const status = (err as { status?: number })?.status;
          const unreachable = status === undefined || status >= 500;
          if (unreachable && attempt < 5) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
            continue;
          }
          if (!unreachable) tokens.clear();
          break;
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{
        data: { admin: Admin; accessToken: string };
      }>('/auth/admin/login', { email, password }, { noAuth: true });

      tokens.set(res.data.accessToken);
      await api
        .get<{ data: { organization?: { baseCurrency: string; timezone: string } | null } }>('/auth/admin/me')
        .then((me) => setFormatPrefs(me.data.organization))
        .catch(() => {});
      setAdmin(res.data.admin);
      setPermissions(res.data.admin.role?.permissions ?? []);
      router.push('/admin');
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/admin/logout');
    } catch {
    }
    tokens.clear();
    setAdmin(null);
    setPermissions([]);
    router.push('/admin/login');
  }, [router]);

  const can = useCallback(
    (permission: string) => permissions.includes('*') || permissions.includes(permission),
    [permissions]
  );

  return (
    <AuthContext.Provider value={{ admin, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
