import { useState, useCallback } from 'react';
import { User, FinancialData } from '../types';

// Mock user for development
const MOCK_USER: User = {
    firstName: 'Dev',
    lastName: 'User',
    email: 'dev@finaura.app',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=dev@finaura.app',
    role: 'Administrator',
    is2FAEnabled: false,
    status: 'Active',
    lastLogin: new Date().toISOString(),
};

export const useAuth = () => {
  // --- DEVELOPMENT OVERRIDE: Start in a logged-in state ---
  const [user, setUserState] = useState<User | null>(MOCK_USER);
  const [token, setToken] = useState<string | null>('dev-token');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Original functions are disabled for development to bypass login.
  const processAuthState = useCallback(() => {}, []);

  const signOut = useCallback(() => {
    console.log("Sign out disabled in development mode.");
    // To prevent being logged out, this function is now a no-op.
  }, []);
  
  const checkAuthStatus = useCallback(async (): Promise<FinancialData | null> => {
    console.log("Auth check disabled in development mode.");
    // Immediately resolve to prevent loading screen and auth failures.
    // Returning null will cause App.tsx to load initialFinancialData.
    setIsLoading(false);
    return null;
  }, []);

  const signIn = async (email: string, password: string): Promise<FinancialData | null> => {
    console.log("Sign in disabled in development mode.");
    setError("Sign-in is disabled for development.");
    return null;
  };

  const signUp = async (newUserData: { firstName: string, lastName: string, email: string, password: string }): Promise<FinancialData | null> => {
    console.log("Sign up disabled in development mode.");
    setError("Sign-up is disabled for development.");
    return null;
  };
  
  const setUser = async (updates: Partial<User>) => {
      console.log("setUser called in dev mode:", updates);
      setUserState(prev => prev ? { ...prev, ...updates } : null);
  };
  
  const changePassword = async (current: string, newPass: string): Promise<boolean> => {
      console.log("changePassword called in dev mode.");
      if (current === 'password') {
        console.log("Mock password change successful.");
        return true;
      }
      setError("Mock password change failed (incorrect current password).");
      return false;
  };

  return { user, setUser, token, isAuthenticated, isLoading, error, signIn, signUp, signOut, checkAuthStatus, setError, changePassword };
};
