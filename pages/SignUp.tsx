import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, DelphiLogo } from '../constants';
import { Theme, User } from '../types';
import Card from '../components/Card';

interface SignUpProps {
  onSignUp: (newUser: Pick<User, 'firstName' | 'lastName' | 'email'> & { password: string }) => void;
  onNavigateToSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp, onNavigateToSignIn, isLoading, error }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSignUp({ firstName, lastName, email, password });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <DelphiLogo theme={theme as Theme} />
        </div>
        <Card>
          <h2 className="text-2xl font-bold text-center text-light-text dark:text-dark-text mb-2">Create Your Account</h2>
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">Start managing your finances today.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative text-sm" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT_BASE_STYLE}
                  placeholder="John"
                  required
                  autoComplete="given-name"
                />
              </div>
               <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={INPUT_BASE_STYLE}
                  placeholder="Doe"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email-signup" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Email Address</label>
              <input
                id="email-signup"
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
              <label htmlFor="password-signup"  className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Password</label>
              <input
                id="password-signup"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_BASE_STYLE}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            
            <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3 !text-base disabled:opacity-70 disabled:cursor-not-allowed`} disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </div>
              ) : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mt-6">
            Already have an account?{' '}
            <button onClick={onNavigateToSignIn} className="font-semibold text-primary-500 hover:underline">
              Sign In
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default SignUp;