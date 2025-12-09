
import React from 'react';
import { CrystalLogo, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface LandingPageProps {
  onNavigateToSignIn: () => void;
  onNavigateToSignUp: () => void;
  onEnterDemoMode: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToSignIn, onNavigateToSignUp, onEnterDemoMode }) => {
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text font-sans selection:bg-primary-500 selection:text-white overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[128px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <CrystalLogo showText={false} />
            <span className="text-2xl font-extrabold tracking-tight">Crystal</span>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={onNavigateToSignIn}
                className="hidden sm:block text-sm font-semibold hover:text-primary-500 transition-colors"
            >
                Sign In
            </button>
            <button 
                onClick={onNavigateToSignUp}
                className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 !rounded-full shadow-lg shadow-primary-500/20`}
            >
                Get Started
            </button>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-20 pb-32 px-6 text-center max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in-up">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                v1.0 Now Available
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight animate-fade-in-up">
                Clarity for your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500 bg-200% animate-bg-pan">
                    Financial Future.
                </span>
            </h1>
            
            <p className="text-xl text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up">
                Stop guessing where your money goes. Crystal combines privacy-first tracking with intelligent forecasting to give you a clear vision of your wealth.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up">
                <button 
                    onClick={onNavigateToSignUp}
                    className={`${BTN_PRIMARY_STYLE} !text-lg !py-4 !px-8 !rounded-full shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-1 transition-all`}
                >
                    Create Free Account
                </button>
                <button 
                    onClick={onEnterDemoMode}
                    className={`${BTN_SECONDARY_STYLE} !text-lg !py-4 !px-8 !rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10 hover:bg-white dark:hover:bg-white/10`}
                >
                    <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined">science</span>
                        Try Demo Mode
                    </span>
                </button>
            </div>
        </section>

        {/* Feature Grid */}
        <section className="px-6 py-20 bg-white/50 dark:bg-black/20 backdrop-blur-sm border-y border-black/5 dark:border-white/5">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <FeatureCard 
                    icon="lock"
                    title="Privacy First"
                    description="Your financial data belongs to you. Crystal stores data locally or on your self-hosted server, ensuring banking-grade privacy."
                />
                <FeatureCard 
                    icon="show_chart"
                    title="Smart Forecasting"
                    description="Project your balance up to 2 years into the future based on your recurring habits, bills, and financial goals."
                />
                <FeatureCard 
                    icon="psychology"
                    title="AI Assistant"
                    description="Chat with your finances. Ask questions like 'Can I afford a vacation?' and get instant, data-backed answers."
                />
            </div>
        </section>

        {/* Dashboard Preview / Bento Grid */}
        <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need in one view</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Comprehensive tools to manage assets, liabilities, and cash flow.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-dark-card dark:to-[#1a1a1a] rounded-3xl p-8 border border-black/5 dark:border-white/5 shadow-2xl flex flex-col justify-between min-h-[300px] relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 text-primary-500">
                                <span className="material-symbols-outlined">account_balance</span>
                                <span className="font-bold uppercase text-xs tracking-wider">Net Worth Tracking</span>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Watch your wealth grow</h3>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm max-w-md">Aggregate all your accounts—cash, crypto, property, and loans—into a single live net worth metric.</p>
                        </div>
                        <div className="absolute right-0 bottom-0 w-2/3 h-full bg-gradient-to-l from-primary-500/10 to-transparent pointer-events-none"></div>
                        {/* Mock Chart Line */}
                        <svg className="absolute bottom-0 right-0 w-full h-32 text-primary-500/20 group-hover:text-primary-500/30 transition-colors" viewBox="0 0 100 20" preserveAspectRatio="none">
                            <path d="M0 20 L0 15 Q 10 18 20 12 T 40 14 T 60 8 T 80 10 T 100 2 V 20 Z" fill="currentColor" />
                        </svg>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-dark-card rounded-3xl p-8 border border-black/5 dark:border-white/5 shadow-xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                         <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/30">
                            <span className="material-symbols-outlined text-3xl">smart_toy</span>
                         </div>
                         <h3 className="text-xl font-bold mb-2">Gemini AI Inside</h3>
                         <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Powered by Google's Gemini models for intelligent budget advice and planning.</p>
                    </div>

                    <div className="md:col-span-3 bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-8">
                        <div className="relative z-10 max-w-xl">
                            <h3 className="text-3xl font-bold mb-4">Ready to take control?</h3>
                            <p className="text-emerald-100 mb-8 text-lg">Join Crystal today and start making data-driven financial decisions.</p>
                            <button onClick={onNavigateToSignUp} className="bg-white text-emerald-900 hover:bg-emerald-50 px-8 py-3 rounded-full font-bold transition-colors">
                                Get Started for Free
                            </button>
                        </div>
                        <div className="relative z-10 flex-shrink-0">
                            <span className="material-symbols-outlined text-[120px] opacity-20">rocket_launch</span>
                        </div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    </div>
                </div>
            </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t border-black/5 dark:border-white/5 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
             <CrystalLogo showText={false} />
             <span className="font-bold">Crystal</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Crystal Finance. All rights reserved.</p>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="p-6 rounded-2xl bg-light-card dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <h3 className="text-xl font-bold mb-2 text-light-text dark:text-dark-text">{title}</h3>
        <p className="text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
            {description}
        </p>
    </div>
);

export default LandingPage;
