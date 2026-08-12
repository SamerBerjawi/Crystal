import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Page, Theme, User } from '../types';
import { NAV_ITEMS, CrystalLogo, NavItem, ITEM_COLORS } from '../constants';
import ThemeToggle from './ThemeToggle';
import { getColorClasses, getGlowClasses, getBgClasses } from '../utils/colors';
import { APP_VERSION } from '../version';
import Icon from './ui/Icon';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  onLogout: () => void;
  user: User;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: ['Dashboard', 'Accounts', 'Transactions', 'Reports']
  },
  {
    title: 'Planning',
    items: ['Budget', 'Forecasting', 'Investments', 'Schedule & Bills']
  },
  {
    title: 'Management',
    items: ['Subscriptions', 'Quotes & Invoices', 'Tasks', 'Challenges']
  },
  {
    title: 'Configuration',
    items: ['Settings']
  }
];

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  setCurrentPage,
  isSidebarOpen,
  setSidebarOpen,
  theme,
  setTheme,
  isSidebarCollapsed,
  setSidebarCollapsed,
  onLogout,
  user,
  isPrivacyMode,
  togglePrivacyMode
}) => {
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    if (window.innerWidth < 768) { // md breakpoint
      setSidebarOpen(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = currentPage === item.name;
    const itemColor = ITEM_COLORS[item.name] || 'indigo';

    const baseClasses = `group flex items-center rounded-2xl transition-all duration-300 cursor-pointer select-none mx-2.5 my-0.5 relative`;
    const layoutClasses = isSidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-start px-3.5 py-2.5';
    const colorClass = getColorClasses(itemColor, isActive);

    return (
      <li key={item.name} className="mb-0.5 relative flex items-center">
        <div
          onClick={() => handleNavClick(item.name)}
          className={`${baseClasses} ${layoutClasses} ${colorClass} w-full ${!isActive ? 'hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
          title={isSidebarCollapsed ? item.name : undefined}
        >
          {/* Active indicator bar - positioned flush on the left edge of the button */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="active-indicator"
                className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full z-20 ${getGlowClasses(itemColor)}`}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
              />
            )}
          </AnimatePresence>

          {/* Active Background & Smooth Unclipped Ambient Glow */}
          <AnimatePresence>
            {isActive && (
              <>
                <motion.div
                  layoutId="active-bg"
                  className={`absolute inset-0 ${getBgClasses(itemColor)} rounded-2xl border border-black/5 dark:border-white/10`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                />
                <motion.div
                  layoutId="active-glow"
                  className={`absolute inset-0 ${getBgClasses(itemColor)} blur-xl opacity-20 dark:opacity-30 rounded-2xl pointer-events-none`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.25 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Icon & Label */}
          <div className={`flex items-center relative z-10 ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3.5 min-w-0'}`}>
            <Icon name={item.icon} className={`text-[20px] sm:text-[22px] flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_10px_currentColor]' : 'group-hover:scale-110 opacity-70'}`} />
            <span className={`whitespace-nowrap text-[13.5px] font-medium tracking-tight truncate transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden invisible' : 'w-auto opacity-100'}`}>
              {item.name}
            </span>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside
        className={`
            fixed top-0 left-0 bottom-0 z-40 
            flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] 
            md:relative md:h-screen 
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
            ${isSidebarCollapsed ? 'md:w-20' : 'md:w-[270px]'}
        `}
      >
        <div className={`
          flex-1 flex flex-col m-3 md:m-4 h-[calc(100%-24px)] md:h-[calc(100%-32px)]
          ios-regular shadow-2xl rounded-[32px] 
          border border-white/20 dark:border-white/5
          relative safe-top
        `}>
          {/* Background overlay clipping container for subtle top inner gradient */}
          <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 dark:from-white/5 to-transparent" />
          </div>

          {/* Header / Logo */}
          <div className={`h-16 md:h-20 flex items-center flex-shrink-0 transition-all duration-300 relative z-10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-6'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'scale-90' : 'scale-100'}`}>
                <CrystalLogo showText={false} />
              </div>
              <div className={`flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden absolute' : 'opacity-100 w-auto static'}`}>
                <span className="font-bold text-xl tracking-tighter text-gray-900 dark:text-white">Crystal</span>
              </div>
            </div>

            {/* Close Button Mobile */}
            {isSidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden ml-auto p-2 rounded-xl text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10 transition-colors"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 py-2 overflow-y-auto no-scrollbar relative z-10">
            <LayoutGroup id="sidebar-nav">
              <motion.div layout>
                {NAV_GROUPS.map((group, index) => {
                  const groupItems = group.items.map(name => NAV_ITEMS.find(i => i.name === name)).filter(Boolean) as NavItem[];
                  if (groupItems.length === 0) return null;

                  return (
                    <div key={group.title} className={index > 0 ? 'mt-3' : ''}>
                      {!isSidebarCollapsed && (
                        <div className="px-6 mb-2">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-[0.2em] uppercase">
                            {group.title}
                          </span>
                        </div>
                      )}
                      <ul className="space-y-0.5">
                        {groupItems.map((item) => renderNavItem(item))}
                      </ul>
                    </div>
                  );
                })}
              </motion.div>
            </LayoutGroup>
          </nav>

          {/* Footer Area */}
          <div className={`flex-shrink-0 mt-auto relative z-20 transition-all duration-300 ${isSidebarCollapsed ? 'p-3' : 'p-4'}`}>
            <div className="h-px bg-black/5 dark:bg-white/5 mb-4 mx-2" />

            {/* System Controls */}
            <div className={`flex items-center mb-4 ${isSidebarCollapsed ? 'flex-col gap-3' : 'justify-between px-2'}`}>
              <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
                {/* Privacy Toggle */}
                <button
                  onClick={togglePrivacyMode}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${isPrivacyMode ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 shadow-lg shadow-primary-500/20' : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10'}`}
                  title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
                >
                  <Icon name={isPrivacyMode ? 'visibility_off' : 'visibility'} className="text-[19px]" />
                </button>

                {/* Theme Toggle */}
                <ThemeToggle theme={theme} setTheme={setTheme} />
              </div>

              {/* Collapse Button (Desktop Only) */}
              {!isSidebarOpen && (
                <button
                  onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                  className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
                  title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                  <Icon name={isSidebarCollapsed ? 'ChevronRight' : 'ChevronLeft'} className="text-[19px]" />
                </button>
              )}
            </div>

            {/* Profile Card & Popover Menu */}
            <div ref={profileMenuRef} className="relative">
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute bottom-[calc(100%+12px)] z-50 p-1.5 ios-regular rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/5 min-w-[210px] ${isSidebarCollapsed ? 'left-0 md:left-full md:ml-3 md:bottom-0' : 'left-0 right-0'}`}
                  >
                    <button
                      onClick={() => { setCurrentPage('Personal Info'); setProfileMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all duration-200 group"
                    >
                      <Icon name="person" className="text-[19px] text-gray-400 group-hover:text-primary-500 transition-colors" />
                      <span className="font-semibold">My Account</span>
                    </button>
                    <button
                      onClick={() => { setCurrentPage('Preferences'); setProfileMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all duration-200 group"
                    >
                      <Icon name="settings" className="text-[19px] text-gray-400 group-hover:text-primary-500 transition-colors" />
                      <span className="font-semibold">Preferences</span>
                    </button>
                    <div className="h-px bg-black/5 dark:bg-white/5 my-1.5 mx-3"></div>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all duration-200"
                    >
                      <Icon name="logout" className="text-[19px]" />
                      <span className="font-semibold">Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setProfileMenuOpen(prev => !prev)}
                className={`
                  w-full flex items-center rounded-2xl transition-all duration-300 
                  bg-black/5 dark:bg-white/5 border border-white/10 dark:border-white/5
                  hover:bg-black/10 dark:hover:bg-white/10
                  ${isSidebarCollapsed ? 'justify-center h-10 w-10 mx-auto p-0' : 'p-2 gap-3'}
                `}
              >
                <div className="relative flex-shrink-0">
                  <img className="h-8 w-8 rounded-full object-cover bg-gray-200 border border-white/20" src={user.profilePictureUrl} alt="User" loading="lazy" decoding="async" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full"></div>
                </div>

                <div className={`flex-grow text-left overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate tracking-tight">{user.firstName} {user.lastName}</p>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate tracking-widest uppercase">{user.role}</p>
                </div>

                {!isSidebarCollapsed && (
                  <Icon name="unfold_more" className="text-gray-400 text-[18px] mr-1" />
                )}
              </button>
            </div>
            {!isSidebarCollapsed && (
              <div className="pt-2 text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 tracking-widest text-center select-none opacity-70">
                {APP_VERSION}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
