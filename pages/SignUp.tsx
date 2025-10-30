import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, FinauraLogo } from '../constants';
import { Theme, User } from '../types';
import Card from '../components/Card';

interface SignUpProps {
  onSignUp: (newUser: Pick<User, 'firstName' | 'lastName' | 'email'> & { password: string }) => void;
  onNavigateToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp, onNavigateToSignIn }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignUp({ firstName, lastName, email, password });
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
          <h2 className="text-2xl font-bold text-center text-light-text dark:text-dark-text mb-2">Create Your Account</h2>
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">Start managing your finances today.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3 !text-base`}>
              Create Account
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