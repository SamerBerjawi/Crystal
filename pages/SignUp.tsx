
import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, CrystalLogo } from '../constants';
import { Theme, User } from '../types';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSignUp({ firstName, lastName, email, password });
  };

  const FeatureItem = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
      <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/10">
              <span className="material-symbols-outlined text-2xl text-white">{icon}</span>
          </div>
          <div>
              <h3 className="font-bold text-white text-lg">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
          </div>
      </div>
  );

  return (
    <div className="flex min-h-screen bg-light-bg dark:bg-dark-bg">
      {/* Left Side - Visuals/Features */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-900 to-gray-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg">
            <div className="mb-8">
                 <CrystalLogo showText={false} />
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-8 leading-tight">
                Join thousands of users <br/> mastering their money.
            </h2>
            
            <div className="space-y-8">
                <FeatureItem 
                    icon="lock" 
                    title="Private & Secure" 
                    desc="Your data is stored locally or on your own private server. We prioritize your financial privacy." 
                />
                <FeatureItem 
                    icon="timeline" 
                    title="Visual Analytics" 
                    desc="Beautiful charts and heatmaps give you an instant understanding of your spending habits." 
                />
                <FeatureItem 
                    icon="hub" 
                    title="All-in-One Tracking" 
                    desc="Manage cash, investments, property, and debts in a single, unified dashboard." 
                />
            </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative z-10 bg-light-card dark:bg-dark-card lg:bg-transparent lg:dark:bg-transparent">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-light-text dark:text-dark-text mb-2">Create your account</h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Start your journey to financial clarity today.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined text-lg mt-0.5">error</span>
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label htmlFor="firstName" className="block text-sm font-semibold text-light-text dark:text-dark-text">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`${INPUT_BASE_STYLE} !h-12`}
                  placeholder="John"
                  required
                  autoComplete="given-name"
                />
              </div>
               <div className="space-y-1.5">
                <label htmlFor="lastName" className="block text-sm font-semibold text-light-text dark:text-dark-text">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`${INPUT_BASE_STYLE} !h-12`}
                  placeholder="Doe"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email-signup" className="block text-sm font-semibold text-light-text dark:text-dark-text">Email Address</label>
              <div className="relative">
                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                 <input
                    id="email-signup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 !h-12`}
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                 />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password-signup" className="block text-sm font-semibold text-light-text dark:text-dark-text">Password</label>
              <div className="relative">
                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                 <input
                    id="password-signup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 !h-12`}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                 />
              </div>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  Must be at least 8 characters long.
              </p>
            </div>
            
            <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3.5 !text-base !rounded-xl shadow-lg shadow-primary-500/20 mt-4`} disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </div>
              ) : 'Create Account'}
            </button>
        </form>

        <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mt-8">
            Already have an account?{' '}
            <button onClick={onNavigateToSignIn} className="font-bold text-primary-600 hover:text-primary-500 transition-colors">
              Sign In
            </button>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
