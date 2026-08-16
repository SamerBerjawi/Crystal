import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page } from '../types';
import { NAV_ITEMS, ITEM_COLORS } from '../constants';
import { getColorClasses, getBgClasses, getGlowClasses } from '../utils/colors';
import Icon from './ui/Icon';

interface MobileNavbarProps {
  currentPage: string;
  setCurrentPage: (page: Page) => void;
}

/**
 * Apple HIG Bottom Tab Bar — 5 primary tabs.
 *
 * Tab mapping:
 *   Home      → Dashboard
 *   Accounts  → Accounts
 *   Activity  → Transactions
 *   Insights  → Reports (with Budget, Forecasting as sub-tabs)
 *   More      → Bottom sheet grid for all remaining pages
 */
const PRIMARY_TABS = [
  { label: 'Home', icon: 'layout_alt', id: 'Dashboard' as Page, color: 'indigo' },
  { label: 'Accounts', icon: 'wallet', id: 'Accounts' as Page, color: 'emerald' },
  { label: 'Activity', icon: 'receipt', id: 'Transactions' as Page, color: 'amber' },
  { label: 'Insights', icon: 'bar_chart', id: 'Reports' as Page, color: 'blue' },
];

const NAV_CATEGORIES = [
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
      {/* Bottom Floating Navigation Bar — Apple HIG Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <nav
          className="flex items-center justify-around p-1.5 gap-1 bg-white/75 dark:bg-dark-card/85 border-t border-black/5 dark:border-white/10 backdrop-blur-xl safe-bottom shadow-lg shadow-black/5 dark:shadow-black/40"
          style={{ paddingBottom: `calc(0.375rem + env(safe-area-inset-bottom, 0px))` }}
          role="tabbar"
        >
          {PRIMARY_TABS.map((item) => {
            const isActive = currentPage === item.id && !isMoreOpen;
            return (
              <button
                key={item.id}
                onClick={() => handleNavSelect(item.id)}
                aria-label={item.label}
                className={`touch-feedback flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-2xl flex-1 transition-all duration-300 relative ${isActive
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
                <Icon name={item.icon} className={`text-xl transition-all duration-300 relative z-10 ${isActive ? 'scale-110 ' : 'scale-100'}`} />
                <span className="text-xs font-medium tracking-tight relative z-10 mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" Tab Button */}
          <button
            onClick={() => setIsMoreOpen(prev => !prev)}
            aria-label="More navigation options"
            className={`touch-feedback flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-2xl flex-1 transition-all duration-300 relative ${isMoreOpen || !isPrimaryActive
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
            <Icon name={isMoreOpen ? 'close' : 'grid_view'} className={`text-xl transition-all duration-300 relative z-10 ${isMoreOpen || !isPrimaryActive ? 'scale-110 ' : 'scale-100'}`} />
            <span className="text-xs font-medium tracking-tight relative z-10 mt-0.5">
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
              className="absolute inset-0 sheet-backdrop"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="relative z-10 bg-white dark:bg-gray-900 rounded-t-[32px] border-t border-black/10 dark:border-white/10 shadow-2xl max-h-[82vh] flex flex-col overflow-hidden"
              style={{ paddingBottom: `calc(5rem + env(safe-area-inset-bottom, 0px))` }}
            >
              {/* Sheet Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-black/5 dark:border-white/5">
                <div>
                  <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">All Pages</h3>
                  <p className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">Navigate anywhere in Crystal</p>
                </div>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white min-h-[44px] min-w-[44px]"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>

              {/* Categorized Navigation Grid */}
              <div className="overflow-y-auto px-5 py-4 space-y-6 scroll-touch">
                {NAV_CATEGORIES.map((category) => (
                  <div key={category.title} className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/70 dark:text-dark-text-secondary/60 px-1">
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
                            className={`touch-feedback flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 border min-h-[44px] ${isCurrent
                                ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400 font-bold shadow-sm'
                                : 'bg-gray-50/70 dark:bg-gray-800/40 border-black/5 dark:border-white/5 text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getBgClasses(colorKey)}`}>
                              <Icon name={iconName} className={`text-xl ${getColorClasses(colorKey, true)}`} />
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
