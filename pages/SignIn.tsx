
import React, { useState } from 'react';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, CrystalLogo, BTN_SECONDARY_STYLE } from '../constants';
import { Theme, FinancialData } from '../types';
import { useAuth } from '../hooks/useAuth';

interface SignInProps {
  onSignIn: (email: string, password: string) => Promise<FinancialData | null>; // Updated return type
  onNavigateToSignUp: () => void;
  onEnterDemoMode: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onNavigateToSignUp, onEnterDemoMode, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 2FA State
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const { verify2FALogin, setError } = useAuth(); // We need internal verify if props don't provide it, but app handles load
  
  // Note: The App component passes `handleSignIn` which wraps `signIn` from `useAuth`.
  // We need to access `verify2FALogin` via `useAuth` hook or have it passed down. 
  // Since `App.tsx` controls `onSignIn`, we need to change how we call it to get the response.
  // We modified `useAuth` to return the response. We assume `App.tsx` implementation matches.
  
  // Actually, to make this work cleanly without changing App.tsx signature too much, 
  // we will handle the logic inside `handleSubmit` if `onSignIn` returns a promise resolving to the data.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Logic moved to handleLocalSubmit to use hook directly
  };
  
  // Re-implementing logic with direct hook access for fine-grained control
  const { signIn: authSignIn } = useAuth();

  const handleLocalSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (is2FARequired && tempToken) {
          const codeToUse = isBackupMode ? backupCode : twoFactorCode;
          if (!codeToUse) {
              return;
          }
          const result = await verify2FALogin(tempToken, codeToUse);
          if (result) {
             // Success, trigger data load in parent
             window.location.reload(); 
          }
          return;
      }
      
      const res = await authSignIn(email, password);
      if (res?.require2fa && res.tempToken) {
          setIs2FARequired(true);
          setTempToken(res.tempToken);
      } else if (res?.user) {
          if (res.financialData) {
               window.location.reload();
          }
      }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-black dark:to-[#171717]">
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
          <h1 className="text-4xl font-bold text-light-text dark:text-dark-text mb-3 tracking-tight">
            {is2FARequired ? 'Two-Factor Auth' : 'Sign In'}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-lg">
            {is2FARequired ? 'Verify your identity to continue.' : 'Secure entry with MFA and device trust so you can pick up where you left off.'}
          </p>
        </div>

        <form onSubmit={handleLocalSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <span className="material-symbols-outlined text-lg mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {!is2FARequired ? (
            <>
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
            </>
          ) : (
            <>
                {!isBackupMode ? (
                     <div className="space-y-1.5">
                        <label htmlFor="2fa-code" className="block text-sm font-semibold text-light-text dark:text-dark-text">Authentication Code</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock_clock</span>
                            <input
                                id="2fa-code"
                                type="text"
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                                className={`${INPUT_BASE_STYLE} pl-10 !h-12 font-mono tracking-widest text-lg`}
                                placeholder="000 000"
                                maxLength={6}
                                autoFocus
                                required
                                autoComplete="one-time-code"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <label htmlFor="backup-code" className="block text-sm font-semibold text-light-text dark:text-dark-text">Backup Recovery Code</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">vpn_key</span>
                            <input
                                id="backup-code"
                                type="text"
                                value={backupCode}
                                onChange={(e) => setBackupCode(e.target.value)}
                                className={`${INPUT_BASE_STYLE} pl-10 !h-12 font-mono tracking-widest text-lg`}
                                placeholder="Enter code"
                                autoFocus
                                required
                            />
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            Enter one of your 8-character recovery codes.
                        </p>
                    </div>
                )}
            </>
          )}

          <button type="submit" className={`${BTN_PRIMARY_STYLE} w-full !py-3.5 !text-base !rounded-xl shadow-lg shadow-primary-500/20 mt-2`} disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{is2FARequired ? 'Verifying...' : 'Signing In...'}</span>
              </div>
            ) : (is2FARequired ? 'Verify' : 'Sign In')}
          </button>
          
          {is2FARequired && (
              <div className="flex flex-col gap-2 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsBackupMode(!isBackupMode)}
                    className="text-sm font-semibold text-primary-600 hover:text-primary-500 transition-colors"
                  >
                      {isBackupMode ? 'Use Authenticator App' : 'Use Recovery Code'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setIs2FARequired(false); setTempToken(null); setTwoFactorCode(''); setBackupCode(''); setIsBackupMode(false); }}
                    className="w-full text-center text-sm text-light-text-secondary hover:text-light-text"
                  >
                      Back to Login
                  </button>
              </div>
          )}
        </form>

        {!is2FARequired && (
            <>
                <div className="flex items-center my-8">
                {/* Left Line */}
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                
                {/* The Text - Now background-free */}
                <span className="mx-4 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    Or continue with
                </span>
                
                {/* Right Line */}
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
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
            </>
        )}
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
