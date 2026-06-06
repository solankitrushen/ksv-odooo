"use client";

import { apiFetch, ApiError } from "@/lib/backend-fetch";
import { clearAuthFlagCookie } from "@/lib/auth-flag-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";

export type User = {
  _id: string;
  email: string;
  firstName?: string;
  id?: string;
  isActive?: boolean;
  isVerified?: boolean;
  lastName?: string;
  name?: string;
  role: "admin" | "store" | "user";
};

export type VbRole = "admin" | "officer" | "manager" | "vendor";

type MeResponse = {
  user?: User;
  roles?: VbRole[];
  activeTenantId?: string;
};

type AuthValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  refresh: () => void;
  user: User | null;
  roles: VbRole[];
  isVendor: boolean;
  isStaff: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

const LOGOUT_PATH =
  process.env.NEXT_PUBLIC_LOGOUT_PATH ?? "/vb/auth/logout";
const ME_PATH = process.env.NEXT_PUBLIC_ME_PATH ?? "/vb/auth/me";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryFn: async () => {
      try {
        return await apiFetch<MeResponse | User>(ME_PATH);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    queryKey: ["me"],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  });

  const normalizedUser = useMemo<User | null>(() => {
    if (!data) return null;
    const u = (data as MeResponse).user ?? (data as User);
    return u && u.email ? u : null;
  }, [data]);

  const roles = useMemo<VbRole[]>(() => {
    const r = (data as MeResponse | null)?.roles;
    return Array.isArray(r) ? r : [];
  }, [data]);

  const logout = useCallback(async () => {
    try {
      await apiFetch(LOGOUT_PATH, { method: "POST" });
    } catch {}
    clearAuthFlagCookie();
    qc.setQueryData(["me"], null);
    router.replace("/auth/login");
  }, [qc, router]);

  const isVendor = roles.includes("vendor") && !roles.some((r) => r !== "vendor");
  const isStaff = roles.some((r) => r === "admin" || r === "officer" || r === "manager");

  const value: AuthValue = {
    isAuthenticated: Boolean(normalizedUser),
    isLoading,
    logout,
    refresh: () => refetch(),
    user: normalizedUser,
    roles,
    isVendor,
    isStaff,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
