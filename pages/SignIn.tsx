
import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, CrystalLogo, BTN_SECONDARY_STYLE } from '../constants';
import { Theme } from '../types';
import { SignInResult } from '../hooks/useAuth';

interface SignInProps {
  onSignIn: (params: { email: string; password: string; totpCode?: string; rememberDevice?: boolean }) => Promise<SignInResult>;
  onNavigateToSignUp: () => void;
  onEnterDemoMode: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onNavigateToSignUp, onEnterDemoMode, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const result = await onSignIn({ email, password, totpCode: requires2FA ? totpCode : undefined, rememberDevice });

    if (result.status === 'two-factor-required') {
      setRequires2FA(true);
      setLocalError(result.message || 'Enter the 6-digit code from your authenticator app.');
      return;
    }

    if (result.status === 'error') {
      setLocalError(result.message);
      setRequires2FA(false);
      setTotpCode('');
      return;
    }

    setLocalError(null);
    setRequires2FA(false);
    setTotpCode('');
  };

  return (
    <div className="flex min-h-screen bg-light-bg dark:bg-dark-bg">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative z-10 bg-light-card dark:bg-dark-card lg:bg-transparent lg:dark:bg-transparent">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-8">
            <CrystalLogo showText={false} />
            <span className="text-2xl font-extrabold tracking-tight text-light-text dark:text-dark-text">Crystal</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-300 mb-2">
            <span className="material-symbols-outlined text-xl">login</span>
            <span>Welcome Back</span>
          </div>
          <h1 className="text-4xl font-bold text-light-text dark:text-dark-text mb-3 tracking-tight">Sign In</h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-lg">
            Secure entry with MFA and device trust so you can pick up where you left off.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {(error || localError) && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <span className="material-symbols-outlined text-lg mt-0.5">error</span>
              <span>{localError || error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-light-text dark:text-dark-text">Email</label>
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                <input
                    id="email"
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
            <div className="flex justify-between items-center">
                 <label htmlFor="password" className="block text-sm font-semibold text-light-text dark:text-dark-text">Password</label>
                 <button type="button" className="text-xs font-medium text-primary-600 hover:text-primary-500">Forgot password?</button>
            </div>
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 !h-12`}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                />
            </div>
          </div>

          {requires2FA && (
            <div className="space-y-2 bg-primary-50/60 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-500">shield_lock</span>
                <p className="text-sm font-semibold text-light-text dark:text-dark-text">Two-Factor Verification</p>
              </div>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="totp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className={`${INPUT_BASE_STYLE} font-mono tracking-[0.3em] text-lg !h-12`}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                />
                <label className="inline-flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={e => setRememberDevice(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Don't ask again for 7 days on this device
                </label>
              </div>
            </div>
          )}

          <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3.5 !text-base !rounded-xl shadow-lg shadow-primary-500/20 mt-2`} disabled={isLoading || (requires2FA && totpCode.length !== 6)}>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Signing In...</span>
              </div>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-light-card dark:bg-dark-card lg:bg-light-bg lg:dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary font-medium">Or continue with</span>
          </div>
        </div>

        <button onClick={onEnterDemoMode} className={`${BTN_SECONDARY_STYLE} w-full !py-3.5 !text-base !rounded-xl flex items-center justify-center gap-2 group`}>
            <span className="material-symbols-outlined text-primary-500 group-hover:scale-110 transition-transform">science</span>
            Explore Demo Mode
        </button>

        <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary mt-8">
          Don't have an account?{' '}
          <button onClick={onNavigateToSignUp} className="font-bold text-primary-600 hover:text-primary-500 transition-colors">
            Sign up for free
          </button>
        </p>
      </div>

      {/* Right Side - Visuals */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden items-center justify-center p-12">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary-500/30 rounded-full blur-3xl mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

        <div className="relative z-10 max-w-lg text-white">
            <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-sm font-medium">
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live AI Insights
            </div>
            <h2 className="text-5xl font-bold mb-6 leading-tight">Clarity for your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">Financial Future.</span></h2>
            <p className="text-lg text-gray-300 mb-10 leading-relaxed">
                Stop guessing where your money goes. Crystal combines powerful tracking with AI forecasting to give you a clear vision of your wealth.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-3xl text-primary-400 mb-2">show_chart</span>
                    <h3 className="font-bold text-lg mb-1">Smart Forecasting</h3>
                    <p className="text-sm text-gray-400">Predict future balances based on recurring habits.</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-3xl text-purple-400 mb-2">smart_toy</span>
                    <h3 className="font-bold text-lg mb-1">AI Assistant</h3>
                    <p className="text-sm text-gray-400">Chat with your data to get instant financial answers.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
