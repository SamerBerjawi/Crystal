import { useState, useCallback } from 'react';
import { User, FinancialData } from '../types';

interface AuthResponse {
  token: string;
  user: any;
  financialData?: FinancialData;
}

const TOKEN_STORAGE_KEY = 'finaura_auth_token';

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

const getStoredToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

const persistToken = (newToken: string | null) => {
  if (typeof window === 'undefined') return;
  if (newToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const useAuth = () => {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getStoredToken()));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const processAuthState = useCallback((payload: AuthResponse | null): FinancialData | null => {
    if (!payload) return null;

    const mappedUser = mapApiUserToUser(payload.user);
    setUserState(mappedUser);
    setToken(payload.token);
    persistToken(payload.token);
    setIsAuthenticated(true);
    setError(null);

    return payload.financialData ?? null;
  }, []);

  const signOut = useCallback(() => {
    setUserState(null);
    setToken(null);
    persistToken(null);
    setIsAuthenticated(false);
    setError(null);
    setIsLoading(false);
  }, []);

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const activeToken = token ?? getStoredToken();
      const headers = new Headers(init.headers || {});
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      return fetch(input, { ...init, headers });
    },
    [token]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<FinancialData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
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
        persistToken(null);
        setToken(null);
        setError(err instanceof Error ? err.message : 'Failed to sign in.');
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
        persistToken(null);
        setToken(null);
        setError(err instanceof Error ? err.message : 'Failed to register.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [processAuthState]
  );

  const checkAuthStatus = useCallback(async (): Promise<FinancialData | null> => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      signOut();
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [userRes, dataRes] = await Promise.all([
        fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        }),
        fetch('/api/data', {
          headers: { Authorization: `Bearer ${storedToken}` },
        }),
      ]);

      if (!userRes.ok) {
        const errorBody = await userRes.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to fetch user profile.');
      }

      const userPayload = await userRes.json();
      setUserState(mapApiUserToUser(userPayload));
      setToken(storedToken);
      persistToken(storedToken);
      setIsAuthenticated(true);

      if (!dataRes.ok) {
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
        const activeToken = token ?? getStoredToken();
        if (!activeToken) {
          return;
        }

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
    [authorizedFetch, token]
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
        return true;
      } catch (err) {
        console.error('Failed to change password:', err);
        setError(err instanceof Error ? err.message : 'Failed to change password.');
        return false;
      }
    },
    [authorizedFetch]
  );

  return { user, setUser, token, isAuthenticated, isLoading, error, signIn, signUp, signOut, checkAuthStatus, setError, changePassword };
};
