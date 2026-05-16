import React from 'react';

interface MobileNavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const MobileNavbar: React.FC<MobileNavbarProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { label: 'Dashboard', icon: 'dashboard', id: 'Dashboard' },
    { label: 'Accounts', icon: 'account_balance', id: 'Accounts' },
    { label: 'Transactions', icon: 'receipt_long', id: 'Transactions' },
    { label: 'Forecasting', icon: 'trending_up', id: 'Forecasting' },
    { label: 'Investments', icon: 'account_balance_wallet', id: 'Investments' },
  ];

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-sm">
      <nav className="bg-white/80 dark:bg-[#1E1E20]/80 backdrop-blur-[10px] border border-black/5 dark:border-white/10 rounded-full shadow-2xl flex items-center justify-around p-1.5 gap-1 ring-1 ring-black/5">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-full flex-1 transition-all duration-300 relative ${
                isActive 
                  ? 'text-primary-600 dark:text-primary-400' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {isActive && (
                <>
                  <div className="absolute inset-x-1 inset-y-1 bg-primary-500/10 rounded-full animate-in fade-in zoom-in duration-300"></div>
                  {/* Glow Effect */}
                  <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full scale-75 animate-pulse duration-[3000ms]"></div>
                </>
              )}
              <span className={`material-symbols-outlined text-[24px] transition-transform duration-500 relative z-10 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-color-rgb),0.5)]' : 'scale-100'}`}>
                {item.icon}
              </span>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(var(--primary-color-rgb),0.8)]"></div>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileNavbar;
