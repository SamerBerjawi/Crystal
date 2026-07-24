import React from 'react';

interface MobileNavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const MobileNavbar: React.FC<MobileNavbarProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { label: 'Dashboard', icon: 'dashboard', id: 'Dashboard', color: 'indigo' },
    { label: 'Accounts', icon: 'account_balance', id: 'Accounts', color: 'emerald' },
    { label: 'Transactions', icon: 'receipt_long', id: 'Transactions', color: 'amber' },
    { label: 'Forecasting', icon: 'trending_up', id: 'Forecasting', color: 'purple' },
    { label: 'Investments', icon: 'account_balance_wallet', id: 'Investments', color: 'cyan' },
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    if (!isActive) return 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300';
    
    switch (color) {
      case 'indigo': return 'text-indigo-600 dark:text-indigo-400';
      case 'emerald': return 'text-emerald-600 dark:text-emerald-400';
      case 'amber': return 'text-amber-600 dark:text-amber-400';
      case 'purple': return 'text-purple-600 dark:text-purple-400';
      case 'cyan': return 'text-cyan-600 dark:text-cyan-400';
      default: return 'text-primary-600 dark:text-primary-400';
    }
  };

  const getGlowClasses = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.7)]';
      case 'emerald': return 'bg-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.7)]';
      case 'amber': return 'bg-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.7)]';
      case 'purple': return 'bg-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.7)]';
      case 'cyan': return 'bg-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.7)]';
      default: return 'bg-primary-500/50 shadow-[0_0_30px_rgba(var(--primary-color-rgb),0.7)]';
    }
  };

  const getBgClasses = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500/10';
      case 'emerald': return 'bg-emerald-500/10';
      case 'amber': return 'bg-amber-500/10';
      case 'purple': return 'bg-purple-500/10';
      case 'cyan': return 'bg-cyan-500/10';
      default: return 'bg-primary-500/10';
    }
  };

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-sm">
      <nav 
        className="flex items-center justify-around p-1.5 gap-1 ios-regular shadow-xl"
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
        }}
      >
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center py-2.5 px-1 min-h-[44px] rounded-2xl flex-1 transition-all duration-300 relative ${isActive ? getColorClasses(item.color || '', true) : 'text-light-text-secondary/40 dark:text-dark-text-secondary/30'}`}
            >
              {isActive && (
                <>
                  <div className={`absolute inset-x-0.5 inset-y-0.5 ${getBgClasses(item.color || '')} rounded-[1.25rem] animate-in fade-in zoom-in duration-300`}></div>
                  {/* Enhanced Glow Effect */}
                  <div className={`absolute inset-0 ${getGlowClasses(item.color || '')} blur-2xl rounded-2xl scale-110 opacity-60 animate-pulse duration-[2000ms]`}></div>
                </>
              )}
              <span className={`material-symbols-outlined text-[24px] transition-all duration-500 relative z-10 ${isActive ? 'scale-110 filled-icon drop-shadow-[0_0_10px_currentColor]' : 'scale-100 opacity-60'}`}>
                {item.icon}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileNavbar;
