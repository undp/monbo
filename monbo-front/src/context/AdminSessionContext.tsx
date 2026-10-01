"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AdminApiError,
  createAdminSession,
  getAdminSession,
} from "@/api/adminLayers";
import { AdminSession } from "@/interfaces/AdminLayer";
import { localizedPath } from "@/utils/languageChange";

// sessionStorage only: the token dies with the tab. The passkey is never stored.
const STORAGE_KEY = "monbo.adminSession";

interface AdminSessionContextValue {
  session: AdminSession | null;
  // false until the stored token (if any) has been checked
  ready: boolean;
  login: (passkey: string) => Promise<void>;
  logout: () => void;
  // Runs an admin API call with the token; a 401 signs out and goes to login.
  withToken: <T>(call: (token: string) => Promise<T>) => Promise<T>;
}

export const AdminSessionContext = createContext<AdminSessionContextValue>({
  session: null,
  ready: false,
  login: async () => {},
  logout: () => {},
  withToken: () => Promise.reject(new Error("No admin session provider")),
});

const readStoredSession = (): AdminSession | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as AdminSession) : null;
    if (session && Date.parse(session.expiresAt) > Date.now()) return session;
  } catch {
    // unreadable: treat as signed out
  }
  sessionStorage.removeItem(STORAGE_KEY);
  return null;
};

export const AdminSessionProvider: React.FC<{
  children: React.ReactNode;
  // The page's language, to send an expired session to the login in it
  locale: string;
}> = ({ children, locale }) => {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const signOutToLogin = useCallback(() => {
    logout();
    router.replace(localizedPath("/admin", locale));
  }, [logout, router, locale]);

  // Restore and re-check a token from a previous page load.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setReady(true);
      return;
    }
    getAdminSession(stored.token)
      .then(({ country }) => setSession({ ...stored, country }))
      .catch(() => sessionStorage.removeItem(STORAGE_KEY))
      .finally(() => setReady(true));
  }, []);

  // Sign out when the token expires. Only sign out: the provider wraps the whole
  // app (the header shows the session's country), and the admin pages already
  // send a visitor without a session to the login.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(logout, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [session, logout]);

  const login = useCallback(async (passkey: string) => {
    const newSession = await createAdminSession(passkey);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const withToken = useCallback(
    async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
      if (!session) {
        signOutToLogin();
        throw new AdminApiError(401, "Admin session required");
      }
      try {
        return await call(session.token);
      } catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          signOutToLogin();
        }
        throw error;
      }
    },
    [session, signOutToLogin]
  );

  const value = useMemo(
    () => ({ session, ready, login, logout, withToken }),
    [session, ready, login, logout, withToken]
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
};
