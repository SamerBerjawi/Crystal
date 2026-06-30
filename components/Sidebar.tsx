
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Page, Theme, User } from '../types';
import { NAV_ITEMS, CrystalLogo, NavItem, ITEM_COLORS } from '../constants';
import ThemeToggle from './ThemeToggle';

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
    items: ['Settings', 'Merchants', 'Rules']
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

  const getColorClasses = (color: string, isActive: boolean) => {
    if (!isActive) return 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100';
    
    switch (color) {
      case 'indigo': return 'text-indigo-600 dark:text-indigo-400';
      case 'emerald': return 'text-emerald-600 dark:text-emerald-400';
      case 'amber': return 'text-amber-600 dark:text-amber-400';
      case 'purple': return 'text-purple-600 dark:text-purple-400';
      case 'cyan': return 'text-cyan-600 dark:text-cyan-400';
      case 'blue': return 'text-blue-600 dark:text-blue-400';
      case 'teal': return 'text-teal-600 dark:text-teal-400 font-bold';
      case 'orange': return 'text-orange-600 dark:text-orange-400';
      case 'rose': return 'text-rose-600 dark:text-rose-400 font-bold';
      case 'violet': return 'text-violet-600 dark:text-violet-400';
      case 'slate': return 'text-slate-600 dark:text-slate-400';
      case 'lime': return 'text-lime-600 dark:text-lime-400';
      case 'gray': return 'text-gray-600 dark:text-gray-400';
      case 'sky': return 'text-sky-600 dark:text-sky-400';
      case 'pink': return 'text-pink-600 dark:text-pink-400';
      case 'primary': return 'text-primary-600 dark:text-primary-400';
      default: return 'text-primary-600 dark:text-primary-400';
    }
  };

  const getGlowClasses = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.5)]';
      case 'emerald': return 'bg-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
      case 'amber': return 'bg-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.5)]';
      case 'purple': return 'bg-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.5)]';
      case 'cyan': return 'bg-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.5)]';
      case 'blue': return 'bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.5)]';
      case 'teal': return 'bg-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.5)]';
      case 'orange': return 'bg-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.5)]';
      case 'rose': return 'bg-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.5)]';
      case 'violet': return 'bg-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.5)]';
      case 'slate': return 'bg-slate-500/50 shadow-[0_0_20px_rgba(100,116,139,0.5)]';
      case 'lime': return 'bg-lime-500/50 shadow-[0_0_20px_rgba(132,204,22,0.5)]';
      case 'gray': return 'bg-gray-500/50 shadow-[0_0_20px_rgba(107,114,128,0.5)]';
      case 'sky': return 'bg-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.5)]';
      case 'pink': return 'bg-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.5)]';
      default: return 'bg-primary-500/50 shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.5)]';
    }
  };

  const getBgClasses = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500/10';
      case 'emerald': return 'bg-emerald-500/10';
      case 'amber': return 'bg-amber-500/10';
      case 'purple': return 'bg-purple-500/10';
      case 'cyan': return 'bg-cyan-500/10';
      case 'blue': return 'bg-blue-500/10';
      case 'teal': return 'bg-teal-500/10';
      case 'orange': return 'bg-orange-500/10';
      case 'rose': return 'bg-rose-500/10';
      case 'violet': return 'bg-violet-500/10';
      case 'slate': return 'bg-slate-500/10';
      case 'lime': return 'bg-lime-500/10';
      case 'gray': return 'bg-gray-500/10';
      case 'sky': return 'bg-sky-500/10';
      case 'pink': return 'bg-pink-500/10';
      default: return 'bg-primary-500/10';
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = currentPage === item.name;
    const itemColor = ITEM_COLORS[item.name] || 'primary';

    const baseClasses = `group flex items-center rounded-2xl transition-all duration-300 cursor-pointer select-none mx-3 my-0.5 relative overflow-hidden`;
    const layoutClasses = isSidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-2.5';
    const colorClass = getColorClasses(itemColor, isActive);

    return (
      <li key={item.name} className="mb-1 relative flex items-center">
        {/* Left Indicator - Positioned smoothly via parent flexbox alignment */}
        <div className="absolute left-[3px] w-1 h-full flex items-center justify-center z-20">
          <AnimatePresence>
            {isActive && (
              <motion.div 
                layoutId="active-indicator"
                className={`w-1 rounded-r-full ${getGlowClasses(itemColor).split(' ')[0]}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 24, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
              />
            )}
          </AnimatePresence>
        </div>

        <div
          onClick={() => handleNavClick(item.name)}
          className={`${baseClasses} ${layoutClasses} ${colorClass} w-full ${!isActive && 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          title={isSidebarCollapsed ? item.name : undefined}
        >
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <AnimatePresence>
                  {isActive && (
                    <>
                      <motion.div 
                        layoutId="active-bg"
                        className={`absolute inset-0 ${getBgClasses(itemColor)} rounded-2xl`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      />
                      <motion.div 
                        layoutId="active-glow"
                        className={`absolute -inset-4 ${getGlowClasses(itemColor)} blur-2xl opacity-30 rounded-full`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                      />
                    </>
                  )}
                </AnimatePresence>
            </div>

            <div className={`flex items-center relative z-10 ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3 min-w-0'}`}>
              <span className={`material-symbols-outlined text-[20px] sm:text-[22px] flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110 filled-icon drop-shadow-[0_0_8px_currentColor]' : 'group-hover:scale-110 opacity-70'}`}>
                {item.icon}
              </span>
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
            ${isSidebarCollapsed ? 'md:w-24' : 'md:w-[280px]'}
        `}
      >
        <div className={`
          flex-1 flex flex-col m-4 h-[calc(100%-32px)]
          ios-regular shadow-2xl rounded-[32px] 
          border border-white/20 dark:border-white/5
          relative overflow-hidden
        `}>
          {/* Subtle Inner Glow */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 dark:from-white/5 to-transparent pointer-events-none" />

          {/* Header / Logo */}
          <div className={`h-20 flex items-center flex-shrink-0 transition-all duration-300 relative z-10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-8'}`}>
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
                      <span className="material-symbols-outlined">close</span>
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
                    <div className="px-8 mb-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                        {group.title}
                      </span>
                    </div>
                  )}
                  <ul className="space-y-1">
                    {groupItems.map((item) => renderNavItem(item))}
                  </ul>
                </div>
              );
            })}
            </motion.div>
          </LayoutGroup>
        </nav>

          {/* Footer Area */}
          <div className="flex-shrink-0 p-5 mt-auto relative z-10">
              <div className="h-px bg-black/5 dark:bg-white/5 mb-6 mx-3" />
              
              {/* System Controls */}
              <div className={`flex items-center mb-6 ${isSidebarCollapsed ? 'flex-col gap-4' : 'justify-between px-3'}`}>
                   <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
                      {/* Privacy Toggle */}
                      <button
                          onClick={togglePrivacyMode}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${isPrivacyMode ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 shadow-lg shadow-primary-500/20' : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10'}`}
                          title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
                      >
                          <span className="material-symbols-outlined text-[19px]">{isPrivacyMode ? 'visibility_off' : 'visibility'}</span>
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
                         <span className="material-symbols-outlined text-[19px]">
                            {isSidebarCollapsed ? 'last_page' : 'first_page'}
                        </span>
                    </button>
                  )}
              </div>

              {/* Profile Card */}
              <div ref={profileMenuRef} className="relative">
                  <AnimatePresence>
                    {isProfileMenuOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-50 p-1.5 ios-regular rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden ring-1 ring-black/5 min-w-[210px]"
                        >
                            <button
                                onClick={() => { setCurrentPage('Personal Info'); setProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all duration-200 group"
                            >
                                <span className="material-symbols-outlined text-[19px] text-gray-400 group-hover:text-primary-500 transition-colors">person</span>
                                <span className="font-semibold">My Account</span>
                            </button>
                             <button
                                onClick={() => { setCurrentPage('Preferences'); setProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all duration-200 group"
                            >
                                <span className="material-symbols-outlined text-[19px] text-gray-400 group-hover:text-primary-500 transition-colors">settings</span>
                                <span className="font-semibold">Preferences</span>
                            </button>
                            <div className="h-px bg-black/5 dark:bg-white/5 my-1.5 mx-3"></div>
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all duration-200"
                            >
                                <span className="material-symbols-outlined text-[19px]">logout</span>
                                <span className="font-semibold">Sign Out</span>
                            </button>
                        </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <button
                      onClick={() => setProfileMenuOpen(prev => !prev)}
                      className={`
                          w-full flex items-center p-2 rounded-2xl transition-all duration-300 
                          bg-black/5 dark:bg-white/5 border border-white/10 dark:border-white/5
                          hover:bg-black/10 dark:hover:bg-white/10
                          ${isSidebarCollapsed ? 'justify-center aspect-square p-0' : 'gap-3'}
                      `}
                  >
                      <div className="relative flex-shrink-0">
                           <img className="h-9 w-9 rounded-full object-cover bg-gray-200 border border-white/20" src={user.profilePictureUrl} alt="User" loading="lazy" decoding="async" />
                           <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full"></div>
                      </div>
                      
                      <div className={`flex-grow text-left overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
                          <p className="font-bold text-sm text-gray-900 dark:text-white truncate tracking-tight">{user.firstName} {user.lastName}</p>
                          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate uppercase tracking-widest">{user.role}</p>
                      </div>
                      
                      {!isSidebarCollapsed && (
                          <span className="material-symbols-outlined text-gray-400 text-[18px] mr-1">unfold_more</span>
                      )}
                  </button>
              </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
