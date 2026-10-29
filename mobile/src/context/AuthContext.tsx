import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { MobileApiClient } from "../api/mobileApiClient";

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "team_lead" | "senior_counselor" | "counselor" | "telecaller" | "viewer";
  avatar_color?: string;
  is_active: number;
}

interface AuthContextType {
  currentUser: MobileUser | null;
  permissions: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await MobileApiClient.fetchJson<{
        authenticated: boolean;
        user: MobileUser;
        permissions: any;
      }>("/api/auth/me");

      if (data?.authenticated && data.user) {
        setCurrentUser(data.user);
        setPermissions(data.permissions);
      } else {
        setCurrentUser(null);
        setPermissions(null);
      }
    } catch {
      setCurrentUser(null);
      setPermissions(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await MobileApiClient.fetchJson<{
        user: MobileUser;
        permissions: any;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        setCurrentUser(data.user);
        setPermissions(data.permissions);
        return { success: true };
      }

      return { success: false, error: "Invalid credentials" };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to log in" };
    }
  };

  const logout = async () => {
    try {
      await MobileApiClient.fetchJson("/api/auth/logout", { method: "POST" });
    } finally {
      await MobileApiClient.setSessionCookie(null);
      setCurrentUser(null);
      setPermissions(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        permissions,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
