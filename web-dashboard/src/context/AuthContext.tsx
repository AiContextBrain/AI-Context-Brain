import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  token: string;
  refreshToken?: string;
  plan?: string;
  role?: string;
  isEmailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<{ success: boolean; emailSent?: boolean; emailError?: string }>;
  logout: () => void;
  generateExtensionToken: (editor?: string) => Promise<string | null>;
  refreshUser: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.aicontextbrain.me';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers for persistent storage ──
function loadUser(): User | null {
  try {
    const saved = localStorage.getItem('apb_user');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return null;
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem('apb_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('apb_user');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUser());
  const userRef = useRef<User | null>(user);
  const refreshPromiseRef = useRef<Promise<User | null> | null>(null);

  // Keep ref in sync for use inside closures
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    saveUser(user);
  }, [user]);

  // ── Migrate old sessionStorage/localStorage data ──
  useEffect(() => {
    if (!user) {
      try {
        const oldSession = sessionStorage.getItem('user');
        const oldLocal = localStorage.getItem('user');
        const old = oldSession || oldLocal;
        if (old) {
          const parsed = JSON.parse(old);
          setUser(parsed);
        }
      } catch {}
    }
    // Clean up old keys
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
  }, []);

  // ── Core: refresh tokens when JWT expires ──
  const refreshTokens = useCallback((): Promise<User | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
    const current = userRef.current;
    if (!current?.refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const refreshed: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          token: data.user.token,
          refreshToken: data.user.refreshToken,
          plan: data.user.plan,
          role: data.user.role,
          isEmailVerified: data.user.isEmailVerified,
        };
        userRef.current = refreshed;
        setUser(refreshed);
        return refreshed;
      }
    } catch {}

    // Refresh failed → force logout
    userRef.current = null;
    setUser(null);
    return null;
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, []);

  // ── authFetch: auto-retry on 401 with token refresh ──
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const current = userRef.current;
    if (!current) {
      return fetch(url, options);
    }

    // Inject Authorization header
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${current.token}`);
    const opts: RequestInit = { ...options, headers };

    let response = await fetch(url, opts);

    // If 401, try to refresh tokens and retry ONCE
    if (response.status === 401) {
      if (current.refreshToken) {
        const refreshed = await refreshTokens();
        if (refreshed) {
          headers.set('Authorization', `Bearer ${refreshed.token}`);
          response = await fetch(url, { ...options, headers });
        }
      }
      
      // If still 401, force logout and redirect to login
      if (response.status === 401) {
        setUser(null);
      }
    }

    return response;
  }, [refreshTokens]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const u: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          token: data.user.token,
          refreshToken: data.user.refreshToken,
          plan: data.user.plan,
          role: data.user.role,
          isEmailVerified: data.user.isEmailVerified,
        };
        setUser(u);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string): Promise<{ success: boolean; emailSent?: boolean; emailError?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const u: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          token: data.user.token,
          refreshToken: data.user.refreshToken,
          plan: data.user.plan,
          role: data.user.role,
          isEmailVerified: data.user.isEmailVerified,
        };
        setUser(u);
        return {
          success: true,
          emailSent: data.emailSent !== false,
          emailError: data.emailError,
        };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const current = userRef.current;
    if (!current) return;
    try {
      const r = await authFetch(`${API_BASE}/user/me`);
      if (r.ok) {
        const d = await r.json();
        setUser(prev => {
          if (!prev) return null;
          if (prev.plan === d.plan && prev.role === d.role && prev.isEmailVerified === d.isEmailVerified && prev.username === d.username) {
            return prev;
          }
          return { ...prev, plan: d.plan, role: d.role, isEmailVerified: d.isEmailVerified, username: d.username };
        });
      }
    } catch {}
  }, [authFetch]);

  const generateExtensionToken = useCallback(async (editor?: string): Promise<string | null> => {
    const current = userRef.current;
    if (!current) return null;

    try {
      const response = await authFetch(`${API_BASE}/auth/authorize?from=${editor || 'vscode'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        return data.extensionToken;
      }
      return null;
    } catch {
      return null;
    }
  }, [authFetch]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, generateExtensionToken, refreshUser, authFetch }}>
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
