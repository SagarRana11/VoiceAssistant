"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore, type User } from "./api";

type AuthResponse = { token: string; user: User };
type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = tokenStore.get()
      ? api<{ user: User }>("/auth/me")
          .then((d) => setUser(d.user))
          .catch(() => tokenStore.clear())
      : Promise.resolve();
    check.finally(() => setLoading(false));
  }, []);

  const accept = useCallback((d: AuthResponse) => {
    tokenStore.set(d.token);
    setUser(d.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      accept(await api<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
    [accept],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) =>
      accept(
        await api<AuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        }),
      ),
    [accept],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
