import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page } from '../types';
import { NAV_ITEMS, ITEM_COLORS } from '../constants';
import { getColorClasses, getBgClasses, getGlowClasses } from '../utils/colors';

interface MobileNavbarProps {
  currentPage: string;
  setCurrentPage: (page: Page) => void;
}

const PRIMARY_TABS = [
  { label: 'Dashboard', icon: 'space_dashboard', id: 'Dashboard' as Page, color: 'indigo' },
  { label: 'Accounts', icon: 'wallet', id: 'Accounts' as Page, color: 'emerald' },
  { label: 'Transactions', icon: 'receipt_long', id: 'Transactions' as Page, color: 'amber' },
  { label: 'Forecast', icon: 'show_chart', id: 'Forecasting' as Page, color: 'purple' },
];

const NAV_CATEGORIES = [
  {
    title: 'Overview',
    items: ['Dashboard', 'Accounts', 'Transactions', 'Reports'] as Page[],
  },
  {
    title: 'Planning',
    items: ['Budget', 'Forecasting', 'Investments', 'Schedule & Bills'] as Page[],
  },
  {
    title: 'Management',
    items: ['Subscriptions', 'Quotes & Invoices', 'Tasks', 'Challenges', 'Merchants'] as Page[],
  },
  {
    title: 'Customization',
    items: ['Categories', 'Tags', 'Rules', 'Integrations', 'Data Management'] as Page[],
  },
  {
    title: 'System',
    items: ['Settings', 'Documentation'] as Page[],
  },
];

const navIconMap: Record<string, string> = NAV_ITEMS.reduce((acc, item) => {
  acc[item.name] = item.icon;
  return acc;
}, {} as Record<string, string>);

const MobileNavbar: React.FC<MobileNavbarProps> = ({ currentPage, setCurrentPage }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isPrimaryActive = PRIMARY_TABS.some(tab => tab.id === currentPage);

  const handleNavSelect = (page: Page) => {
    setCurrentPage(page);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Bottom Floating Navigation Bar */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-sm">
        <nav
          className="flex items-center justify-around p-1.5 gap-1 ios-regular shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border border-black/10 dark:border-white/10 rounded-[28px]"
        >
          {PRIMARY_TABS.map((item) => {
            const isActive = currentPage === item.id && !isMoreOpen;
            return (
              <button
                key={item.id}
                onClick={() => handleNavSelect(item.id)}
                aria-label={item.label}
                className={`flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-2xl flex-1 transition-all duration-300 relative ${
                  isActive
                    ? getColorClasses(item.color, true)
                    : 'text-light-text-secondary/50 dark:text-dark-text-secondary/40'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className={`absolute inset-x-0.5 inset-y-0.5 ${getBgClasses(item.color)} rounded-2xl`}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`material-symbols-outlined text-[22px] transition-all duration-300 relative z-10 ${
                    isActive ? 'scale-110 filled-icon' : 'scale-100'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold tracking-tight relative z-10 mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" Tab Button */}
          <button
            onClick={() => setIsMoreOpen(prev => !prev)}
            aria-label="More navigation options"
            className={`flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-2xl flex-1 transition-all duration-300 relative ${
              isMoreOpen || !isPrimaryActive
                ? 'text-primary-600 dark:text-primary-400 font-bold'
                : 'text-light-text-secondary/50 dark:text-dark-text-secondary/40'
            }`}
          >
            {(isMoreOpen || !isPrimaryActive) && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-x-0.5 inset-y-0.5 bg-primary-500/10 rounded-2xl"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className={`material-symbols-outlined text-[22px] transition-all duration-300 relative z-10 ${
                isMoreOpen || !isPrimaryActive ? 'scale-110 filled-icon' : 'scale-100'
              }`}
            >
              {isMoreOpen ? 'close' : 'grid_view'}
            </span>
            <span className="text-[10px] font-semibold tracking-tight relative z-10 mt-0.5">
              {isMoreOpen ? 'Close' : 'More'}
            </span>
          </button>
        </nav>
      </div>

      {/* Full Sheet "More" Navigation Overlay */}
      <AnimatePresence>
        {isMoreOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="relative z-10 bg-white dark:bg-gray-900 rounded-t-[32px] border-t border-black/10 dark:border-white/10 shadow-2xl max-h-[82vh] flex flex-col overflow-hidden pb-24"
            >
              {/* Sheet Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-black/5 dark:border-white/5">
                <div>
                  <h3 className="text-base font-bold text-light-text dark:text-dark-text">All Pages</h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Navigate anywhere in Crystal</p>
                </div>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Categorized Navigation Grid */}
              <div className="overflow-y-auto px-5 py-4 space-y-6">
                {NAV_CATEGORIES.map((category) => (
                  <div key={category.title} className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/50 px-1">
                      {category.title}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {category.items.map((pageName) => {
                        const iconName = navIconMap[pageName] || 'widgets';
                        const colorKey = ITEM_COLORS[pageName] || 'indigo';
                        const isCurrent = currentPage === pageName;

                        return (
                          <button
                            key={pageName}
                            onClick={() => handleNavSelect(pageName)}
                            className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 border ${
                              isCurrent
                                ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400 font-bold shadow-sm'
                                : 'bg-gray-50/70 dark:bg-gray-800/40 border-black/5 dark:border-white/5 text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getBgClasses(colorKey)}`}>
                              <span className={`material-symbols-outlined text-xl ${getColorClasses(colorKey, true)}`}>
                                {iconName}
                              </span>
                            </div>
                            <span className="text-xs font-semibold truncate leading-tight">
                              {pageName}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNavbar;
