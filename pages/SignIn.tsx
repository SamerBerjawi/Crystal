import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, FinauraLogo } from '../constants';
import { Theme } from '../types';
import Card from '../components/Card';

interface SignInProps {
  onSignIn: (email: string, password: string) => void;
  onNavigateToSignUp: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onNavigateToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <FinauraLogo theme={theme as Theme} />
            <span className="text-3xl font-bold text-light-text dark:text-white">Finaura</span>
          </div>
        </div>
        <Card>
          <h2 className="text-2xl font-bold text-center text-light-text dark:text-dark-text mb-2">Welcome Back!</h2>
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">Sign in to continue to your dashboard.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3 !text-base`}>
              Sign In
            </button>
          </form>
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