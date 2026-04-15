/**
 * AuthContext.tsx
 * Simple shared family login — no email, just User ID + Password.
 * Credentials live in .env so they're never in the codebase.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  login: (userId: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = 'family-finance-auth';
const CORRECT_USER_ID = import.meta.env.VITE_APP_USER_ID || 'family';
const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'finance2024';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    // Persist login across page refreshes (sessionStorage clears on tab close)
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  });

  const login = useCallback((userId: string, password: string) => {
    if (userId.trim() === CORRECT_USER_ID && password === CORRECT_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setIsLoggedIn(true);
      return { success: true };
    }
    return { success: false, error: 'Invalid User ID or Password' };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}