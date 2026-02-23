
import React, { useState, useRef, useEffect } from 'react';
import { Page, Theme, User } from '../types';
import { NAV_ITEMS, CrystalLogo, NavItem } from '../constants';
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
    items: ['Dashboard', 'Accounts', 'Transactions']
  },
  {
    title: 'Planning',
    items: ['Budget', 'Forecasting', 'Investments']
  },
  {
    title: 'Management',
    items: ['Schedule & Bills', 'Subscriptions', 'Quotes & Invoices', 'Tasks']
  },
  {
    title: 'Extras',
    items: ['Challenges', 'Settings']
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
    if (isSidebarCollapsed) {
        setSidebarCollapsed(false);
    }
    setCurrentPage(page);
    if (window.innerWidth < 768) { // md breakpoint
      setSidebarOpen(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = currentPage === item.name;

    // Styles
    const baseClasses = `group flex items-center rounded-xl transition-all duration-200 cursor-pointer select-none mx-3 my-0.5 relative overflow-hidden`;
    const layoutClasses = isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'justify-start px-3 py-2.5';
    
    // Color states
    let colorClass = `text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100`; // Default
    
    if (isActive) {
        colorClass = `bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 font-medium`;
    }

    // Icon Styles
    const iconClass = `material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-200 ${!isActive && 'group-hover:scale-110'}`;

    return (
      <li key={item.name} className="mb-0.5">
        <div
          onClick={() => handleNavClick(item.name)}
          className={`${baseClasses} ${layoutClasses} ${colorClass}`}
          title={isSidebarCollapsed ? item.name : undefined}
        >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-primary-500 rounded-r-full" />
            )}
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'gap-3 min-w-0'}`}>
              <span className={iconClass}>{item.icon}</span>
              <span className={`whitespace-nowrap text-sm truncate transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
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
            bg-white dark:bg-[#0A0A0A]
            border-r border-gray-200/80 dark:border-white/5
            flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] 
            md:relative md:h-screen 
            ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'} 
            ${isSidebarCollapsed ? 'md:w-20' : 'md:w-[260px]'}
        `}
      >
        {/* Header / Logo */}
        <div className={`h-20 flex items-center flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-6'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'scale-90' : 'scale-100'}`}>
                     <CrystalLogo showText={false} />
                </div>
                <div className={`flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden absolute' : 'opacity-100 w-auto static'}`}>
                    <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">Crystal</span>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
          {NAV_GROUPS.map((group, index) => {
            const groupItems = group.items.map(name => NAV_ITEMS.find(i => i.name === name)).filter(Boolean) as NavItem[];
            if (groupItems.length === 0) return null;

            return (
              <div key={group.title} className={index > 0 ? 'mt-6' : ''}>
                {!isSidebarCollapsed && (
                  <div className="px-6 mb-2">
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
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
        </nav>

        {/* Footer Area */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0A0A0A]">
            
            {/* System Controls */}
            <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-3' : 'justify-between mb-4 px-2'}`}>
                 <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
                    {/* Privacy Toggle */}
                    <button
                        onClick={togglePrivacyMode}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isPrivacyMode ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                        title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
                    >
                        <span className="material-symbols-outlined text-[18px]">{isPrivacyMode ? 'visibility_off' : 'visibility'}</span>
                    </button>
                    
                    {/* Theme Toggle */}
                    <div className="scale-100">
                        <ThemeToggle theme={theme} setTheme={setTheme} />
                    </div>
                </div>

                {/* Collapse Button (Desktop Only) */}
                <button
                    onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                    className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                     <span className="material-symbols-outlined text-[18px]">
                        {isSidebarCollapsed ? 'last_page' : 'first_page'}
                    </span>
                </button>
            </div>

            {/* Profile Card */}
            <div ref={profileMenuRef} className="relative">
                {isProfileMenuOpen && (
                    <div className="animate-fade-in-up absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 bg-white dark:bg-[#1E1E20] rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden ring-1 ring-black/5 p-1 w-56">
                        <button
                            onClick={() => { setCurrentPage('Personal Info'); setProfileMenuOpen(false); }}
                            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors group"
                        >
                            <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-primary-500 transition-colors">person</span>
                            <span className="font-medium">My Account</span>
                        </button>
                         <button
                            onClick={() => { setCurrentPage('Preferences'); setProfileMenuOpen(false); }}
                            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors group"
                        >
                            <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-primary-500 transition-colors">settings</span>
                            <span className="font-medium">Preferences</span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2"></div>
                        <button
                            onClick={onLogout}
                            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                            <span className="font-medium">Sign Out</span>
                        </button>
                    </div>
                )}
                
                <button
                    onClick={() => setProfileMenuOpen(prev => !prev)}
                    className={`
                        w-full flex items-center p-2 rounded-xl transition-all duration-200 
                        bg-gray-50 dark:bg-white/5 border border-transparent
                        hover:bg-gray-100 dark:hover:bg-white/10
                        ${isSidebarCollapsed ? 'justify-center aspect-square p-0 bg-transparent dark:bg-transparent' : 'gap-3'}
                    `}
                >
                    <div className="relative flex-shrink-0">
                         <img className="h-8 w-8 rounded-full object-cover bg-gray-200" src={user.profilePictureUrl} alt="User" loading="lazy" decoding="async" />
                         <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#0A0A0A] rounded-full"></div>
                    </div>
                    
                    <div className={`flex-grow text-left overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
                    </div>
                    
                    {!isSidebarCollapsed && (
                        <span className="material-symbols-outlined text-gray-400 text-[18px]">unfold_more</span>
                    )}
                </button>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
