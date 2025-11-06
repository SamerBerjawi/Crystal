import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, AuraFinanceLogo, BTN_SECONDARY_STYLE } from '../constants';
import { Theme } from '../types';
import Card from '../components/Card';

interface SignInProps {
  onSignIn: (email: string, password: string) => void;
  onNavigateToSignUp: () => void;
  onEnterDemoMode: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onNavigateToSignUp, onEnterDemoMode, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSignIn(email, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <AuraFinanceLogo theme={theme as Theme} />
            <span className="text-3xl font-bold text-light-text dark:text-white">Aura Finance</span>
          </div>
        </div>
        <Card>
          <h2 className="text-2xl font-bold text-center text-light-text dark:text-dark-text mb-2">Welcome Back!</h2>
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">Sign in to continue to your dashboard.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative text-sm" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_BASE_STYLE}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password"  className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_BASE_STYLE}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3 !text-base disabled:opacity-70 disabled:cursor-not-allowed`} disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing In...
                </div>
              ) : 'Sign In'}
            </button>
          </form>
          <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 text-sm">Or</span>
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <button onClick={onEnterDemoMode} className={`${BTN_SECONDARY_STYLE} w-full !py-3 !text-base`}>
              Continue in Demo Mode
          </button>
          <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mt-6">
            Don't have an account?{' '}
            <button onClick={onNavigateToSignUp} className="font-semibold text-primary-500 hover:underline">
              Sign Up
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default SignIn;