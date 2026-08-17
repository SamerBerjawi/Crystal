import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page } from '../types';
import { NAV_ITEMS, ITEM_COLORS } from '../constants';
import { getColorClasses, getBgClasses } from '../utils/colors';
import Icon from './ui/Icon';

interface MobileNavbarProps {
  currentPage: string;
  setCurrentPage: (page: Page) => void;
}

/**
 * Tab configuration for the floating bottom navigation bar.
 * Primary tabs:
 *   Home         → Dashboard
 *   Accounts     → Accounts
 *   Activity     → Transactions
 *   Forecasting  → Forecasting
 *   More         → Bottom sheet grid for all remaining pages
 */
const PRIMARY_TABS = [
  { label: 'Home', icon: 'layout_alt', id: 'Dashboard' as Page, color: 'indigo' },
  { label: 'Accounts', icon: 'wallet', id: 'Accounts' as Page, color: 'emerald' },
  { label: 'Activity', icon: 'receipt', id: 'Transactions' as Page, color: 'amber' },
  { label: 'Forecasting', icon: 'PresentationChart01', id: 'Forecasting' as Page, color: 'cyan' },
];

const TAB_GLOW_STYLES: Record<string, { bg: string; border: string; shadow: string; glowRgba: string }> = {
  indigo: {
    bg: 'bg-indigo-500/15 dark:bg-indigo-500/25',
    border: 'border-indigo-500/40 dark:border-indigo-400/40',
    shadow: 'shadow-[0_0_24px_rgba(99,102,241,0.4)]',
    glowRgba: 'rgba(99, 102, 241, 0.65)',
  },
  emerald: {
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/25',
    border: 'border-emerald-500/40 dark:border-emerald-400/40',
    shadow: 'shadow-[0_0_24px_rgba(16,185,129,0.4)]',
    glowRgba: 'rgba(16, 185, 129, 0.65)',
  },
  amber: {
    bg: 'bg-amber-500/15 dark:bg-amber-500/25',
    border: 'border-amber-500/40 dark:border-amber-400/40',
    shadow: 'shadow-[0_0_24px_rgba(245,158,11,0.4)]',
    glowRgba: 'rgba(245, 158, 11, 0.65)',
  },
  cyan: {
    bg: 'bg-cyan-500/15 dark:bg-cyan-500/25',
    border: 'border-cyan-500/40 dark:border-cyan-400/40',
    shadow: 'shadow-[0_0_24px_rgba(6,182,212,0.4)]',
    glowRgba: 'rgba(6, 182, 212, 0.65)',
  },
  primary: {
    bg: 'bg-primary-500/15 dark:bg-primary-500/25',
    border: 'border-primary-500/40 dark:border-primary-400/40',
    shadow: 'shadow-[0_0_24px_rgba(250,154,29,0.4)]',
    glowRgba: 'rgba(250, 154, 29, 0.65)',
  },
};

const NAV_CATEGORIES = [
  {
    title: 'Planning',
    items: ['Budget', 'Reports', 'Investments', 'Schedule & Bills'] as Page[],
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
      {/* Floating Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-6 z-50 pointer-events-none flex justify-center">
        <nav
          className="pointer-events-auto w-full max-w-lg p-1.5 flex items-center justify-around rounded-[1.75rem] sm:rounded-3xl bg-white/60 dark:bg-dark-card/65 backdrop-blur-[32px] saturate-[190%] border border-black/10 dark:border-white/15 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.7),0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300"
          style={{
            marginBottom: 'env(safe-area-inset-bottom, 0px)',
            WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          }}
          role="tabbar"
        >
          {PRIMARY_TABS.map((item) => {
            const isActive = currentPage === item.id && !isMoreOpen;
            const glowStyle = TAB_GLOW_STYLES[item.color] || TAB_GLOW_STYLES.primary;

            return (
              <button
                key={item.id}
                onClick={() => handleNavSelect(item.id)}
                aria-label={item.label}
                className={`touch-feedback flex flex-col items-center justify-center py-2 px-1 min-h-[46px] rounded-2xl flex-1 transition-all duration-300 relative group ${isActive
                    ? `${getColorClasses(item.color, true)} font-bold`
                    : 'text-light-text-secondary/50 dark:text-dark-text-secondary/40 hover:text-light-text-secondary dark:hover:text-dark-text-secondary'
                  }`}
              >
                {isActive && (
                  <>
                    {/* Ambient Glow Aura */}
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-3 rounded-full blur-md opacity-80 pointer-events-none"
                      style={{ backgroundColor: glowStyle.glowRgba }}
                    />

                    {/* Active Pill with Border & Glow Shadow */}
                    <motion.div
                      layoutId="mobile-nav-pill"
                      className={`absolute inset-x-0.5 inset-y-0.5 ${glowStyle.bg} ${glowStyle.shadow} border ${glowStyle.border} rounded-2xl`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  </>
                )}
                <Icon
                  name={item.icon}
                  className={`text-xl transition-all duration-300 relative z-10 ${isActive ? 'scale-110 drop-shadow-sm' : 'scale-100'}`}
                />
                <span className={`text-[11px] leading-tight tracking-tight relative z-10 mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" Tab Button */}
          {(() => {
            const isMoreActive = isMoreOpen || !isPrimaryActive;
            const primaryGlow = TAB_GLOW_STYLES.primary;

            return (
              <button
                onClick={() => setIsMoreOpen(prev => !prev)}
                aria-label="More navigation options"
                className={`touch-feedback flex flex-col items-center justify-center py-2 px-1 min-h-[46px] rounded-2xl flex-1 transition-all duration-300 relative group ${isMoreActive
                    ? 'text-primary-600 dark:text-primary-400 font-bold'
                    : 'text-light-text-secondary/50 dark:text-dark-text-secondary/40 hover:text-light-text-secondary dark:hover:text-dark-text-secondary'
                  }`}
              >
                {isMoreActive && (
                  <>
                    {/* Ambient Glow Aura */}
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-3 rounded-full blur-md opacity-80 pointer-events-none"
                      style={{ backgroundColor: primaryGlow.glowRgba }}
                    />

                    {/* Active Pill with Border & Glow Shadow */}
                    <motion.div
                      layoutId="mobile-nav-pill"
                      className={`absolute inset-x-0.5 inset-y-0.5 ${primaryGlow.bg} ${primaryGlow.shadow} border ${primaryGlow.border} rounded-2xl`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  </>
                )}
                <Icon
                  name={isMoreOpen ? 'close' : 'grid_view'}
                  className={`text-xl transition-all duration-300 relative z-10 ${isMoreActive ? 'scale-110 drop-shadow-sm' : 'scale-100'}`}
                />
                <span className={`text-[11px] leading-tight tracking-tight relative z-10 mt-0.5 ${isMoreActive ? 'font-bold' : 'font-medium'}`}>
                  {isMoreOpen ? 'Close' : 'More'}
                </span>
              </button>
            );
          })()}
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
              style={{ paddingBottom: `calc(5.5rem + env(safe-area-inset-bottom, 0px))` }}
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

