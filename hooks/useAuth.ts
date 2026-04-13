import { useState, useCallback } from 'react';
import { User, FinancialData } from '../types';

interface AuthResponse {
  user?: any;
  financialData?: FinancialData;
}

const mapApiUserToUser = (apiUser: any): User => ({
  firstName: apiUser.firstName ?? '',
  lastName: apiUser.lastName ?? '',
  email: apiUser.email ?? '',
  profilePictureUrl: apiUser.profilePictureUrl ?? '',
  role: apiUser.role ?? 'Member',
  phone: apiUser.phone ?? undefined,
  address: apiUser.address ?? undefined,
  is2FAEnabled: Boolean(apiUser.is2FAEnabled),
  status: apiUser.status ?? 'Active',
  lastLogin: apiUser.lastLogin ?? new Date().toISOString(),
});

const extractApiUser = (payload: AuthResponse | null) => {
  if (payload?.user) return payload.user;
  const fallback = payload?.financialData as any;
  if (fallback?.userProfile) return fallback.userProfile;
  throw new Error('Sign-in succeeded but no user profile was returned.');
};

export const useAuth = () => {
  const [user, setUserState] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const processAuthState = useCallback((payload: AuthResponse | null): FinancialData | null => {
    if (!payload) return null;

    const mappedUser = mapApiUserToUser(extractApiUser(payload));
    setUserState(mappedUser);
    setIsAuthenticated(true);
    setError(null);

    return payload.financialData ?? null;
  }, []);

  const signOut = useCallback(() => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(error => {
      console.warn('Sign-out request failed:', error);
    });

    setUserState(null);
    setIsAuthenticated(false);
    setError(null);
    setIsLoading(false);
  }, []);

  const authorizedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    return fetch(input, {
      ...init,
      credentials: 'include',
    });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<FinancialData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.message || 'Failed to sign in.');
        }

        return processAuthState(body as AuthResponse);
      } catch (err) {
        console.error('Sign-in failed:', err);
        setIsAuthenticated(false);
        setUserState(null);
        if (err instanceof TypeError) {
          setError('Failed to sign in. Network or CORS issue detected.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to sign in.');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [processAuthState]
  );

  const signUp = useCallback(
    async (newUserData: { firstName: string; lastName: string; email: string; password: string }): Promise<FinancialData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUserData),
          credentials: 'include',
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.message || 'Failed to register.');
        }

        return processAuthState(body as AuthResponse);
      } catch (err) {
        console.error('Sign-up failed:', err);
        setIsAuthenticated(false);
        setUserState(null);
        setError(err instanceof Error ? err.message : 'Failed to register.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [processAuthState]
  );

  const checkAuthStatus = useCallback(async (): Promise<FinancialData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const [userRes, dataRes] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'include' }),
        fetch('/api/data', { credentials: 'include' }),
      ]);

      if (userRes.status === 401 || userRes.status === 403) {
        setUserState(null);
        setIsAuthenticated(false);
        return null;
      }

      if (!userRes.ok) {
        const errorBody = await userRes.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to fetch user profile.');
      }

      const userPayload = await userRes.json();
      setUserState(mapApiUserToUser(userPayload));
      setIsAuthenticated(true);

      if (!dataRes.ok) {
        if (dataRes.status === 401 || dataRes.status === 403) {
          setUserState(null);
          setIsAuthenticated(false);
          return null;
        }
        const errorBody = await dataRes.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to fetch financial data.');
      }

      const data = await dataRes.json();
      return data as FinancialData;
    } catch (err) {
      console.error('Auth status check failed:', err);
      signOut();
      setError(err instanceof Error ? err.message : 'Failed to authenticate.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [signOut]);

  const setUser = useCallback(
    (updates: Partial<User>) => {
      setUserState(prev => (prev ? { ...prev, ...updates } : prev));

      (async () => {
        try {
          const response = await authorizedFetch('/api/users/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || 'Failed to update profile.');
          }
        } catch (err) {
          console.error('Failed to update user profile:', err);
          setError(err instanceof Error ? err.message : 'Failed to update user profile.');
        }
      })();
    },
    [authorizedFetch]
  );

  const changePassword = useCallback(
    async (current: string, newPass: string): Promise<boolean> => {
      try {
        const response = await authorizedFetch('/api/users/me/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.message || 'Failed to change password.');
        }

        setError(null);
        signOut();
        return true;
      } catch (err) {
        console.error('Failed to change password:', err);
        setError(err instanceof Error ? err.message : 'Failed to change password.');
        return false;
      }
    },
    [authorizedFetch, signOut]
  );

  return { user, setUser, isAuthenticated, isLoading, error, signIn, signUp, signOut, checkAuthStatus, setError, changePassword, authorizedFetch };
};
