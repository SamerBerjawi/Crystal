

import React, { useState, useRef, useEffect } from 'react';
import { Page, User } from '../types';
import { NAV_ITEMS, CrystalLogo, NavItem } from '../constants';
import { useSidebarState } from '../contexts/SidebarStateContext';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onLogout: () => void;
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, onLogout, user }) => {
  const { isSidebarOpen, setSidebarOpen, isSidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed } = useSidebarState();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(() => {
    const activeParent = NAV_ITEMS.find(item => item.subItems?.some(sub => sub.name === currentPage));
    return activeParent ? activeParent.name : null;
  });
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


  const handleNavClick = (page: Page, hasSubItems?: boolean) => {
    if (isSidebarCollapsed && hasSubItems) {
        setSidebarCollapsed(false);
        setOpenSubMenu(openSubMenu === page ? null : page);
        return;
    }

    if (hasSubItems) {
      setOpenSubMenu(openSubMenu === page ? null : page);
    } else {
      setCurrentPage(page);
      if (window.innerWidth < 768) { // md breakpoint
        setSidebarOpen(false);
      }
    }
  };

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const isActive = currentPage === item.name;
    const isParentActive = !isSubItem && item.subItems?.some(sub => sub.name === currentPage);
    const isSubMenuOpen = openSubMenu === item.name;

    const baseClasses = `group flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer mb-1`;
    const activeClasses = `bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30`;
    const inactiveClasses = `text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-fill dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400`;
    const parentActiveClasses = `bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold`;

    let className = baseClasses;
    if (isActive) className += ` ${activeClasses}`;
    else if (isParentActive) className += ` ${parentActiveClasses}`;
    else className += ` ${inactiveClasses}`;

    if (isSidebarCollapsed) className += ' justify-center px-2';

    const iconEl = (
        <span className={`material-symbols-outlined ${isActive || isParentActive ? 'material-symbols-filled' : ''} text-[22px] transition-transform duration-200 group-hover:scale-110`}>
            {item.icon}
        </span>
    );

    if (item.subItems) {
      return (
        <li key={item.name} title={isSidebarCollapsed ? item.name : undefined}>
          <div
            onClick={() => handleNavClick(item.name, true)}
            className={className}
          >
            <div className={`flex items-center ${isSidebarCollapsed ? 'w-full justify-center' : 'gap-3'}`}>
              {iconEl}
              <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>{item.name}</span>
            </div>
            {!isSidebarCollapsed && (
                 <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isSubMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
            )}
          </div>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSubMenuOpen && !isSidebarCollapsed ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
             <ul className="pl-3 py-1 space-y-1 border-l-2 border-primary-100 dark:border-primary-900/50 ml-6 mb-2">
              {item.subItems.map(sub => renderNavItem(sub, true))}
            </ul>
          </div>
        </li>
      );
    }

    return (
      <li key={item.name} title={isSidebarCollapsed ? item.name : undefined}>
        <div
          onClick={() => handleNavClick(item.name)}
          className={`${className} ${isSubItem ? 'py-2 pl-4 text-sm' : ''}`}
        >
            <div className={`flex items-center ${isSidebarCollapsed ? 'w-full justify-center' : 'gap-3'}`}>
              {iconEl}
              <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>{item.name}</span>
            </div>
        </div>
      </li>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>
      
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-light-card/95 dark:bg-dark-card/95 backdrop-blur-xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:relative md:h-screen ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'}`}
      >
        {/* Header / Logo */}
        <div className={`flex items-center h-24 flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-10' : 'w-full'}`}>
                <div className="flex-shrink-0 transition-transform duration-300 hover:scale-105">
                     <CrystalLogo showText={false} />
                </div>
                <div className={`flex flex-col transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                    <span className="font-extrabold text-xl tracking-tight text-light-text dark:text-dark-text">Crystal</span>
                    <span className="text-[10px] font-bold text-primary-500 tracking-widest uppercase">Finance</span>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 py-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 px-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => renderNavItem(item))}
          </ul>
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 mt-auto relative">
            {/* Collapse Toggle Button - Absolute positioned on the border */}
            <button
                onClick={toggleSidebarCollapsed}
                className="hidden md:flex absolute -top-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 hover:text-primary-500 transition-all hover:scale-110 z-10"
                title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
            >
                <span className="material-symbols-outlined text-lg transform transition-transform duration-300" style={{ transform: isSidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    chevron_left
                </span>
            </button>

            <div ref={profileMenuRef} className="relative">
                {isProfileMenuOpen && (
                    <div className="animate-fade-in-up absolute bottom-full left-0 right-0 mb-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-black/5 dark:border-white/5 overflow-hidden p-1 ring-1 ring-black/5">
                        <button
                            onClick={() => { setCurrentPage('Personal Info'); setProfileMenuOpen(false); }}
                            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <div className="p-1.5 bg-black/5 dark:bg-white/10 rounded-md text-gray-600 dark:text-gray-300">
                                <span className="material-symbols-outlined text-lg">person</span>
                            </div>
                            <span className="font-medium">Account</span>
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2"></div>
                        <button
                            onClick={onLogout}
                            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 text-red-600 hover:bg-black/5 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <div className="p-1.5 bg-black/5 dark:bg-white/10 rounded-md text-red-500">
                                <span className="material-symbols-outlined text-lg">logout</span>
                            </div>
                            <span className="font-medium">Sign Out</span>
                        </button>
                    </div>
                )}
                
                <button
                    onClick={() => setProfileMenuOpen(prev => !prev)}
                    className={`w-full flex items-center p-2 rounded-xl transition-all duration-200 hover:bg-white dark:hover:bg-white/5 hover:shadow-sm border border-transparent hover:border-black/5 dark:hover:border-white/5 ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}
                >
                    <div className="relative">
                         <img className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-700 shadow-sm" src={user.profilePictureUrl} alt="User" loading="lazy" decoding="async" />
                         <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    </div>
                    
                    <div className={`flex-grow text-left overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                        <p className="font-bold text-sm truncate text-light-text dark:text-dark-text">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{user.role}</p>
                    </div>
                    {!isSidebarCollapsed && (
                        <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-lg">more_vert</span>
                    )}
                </button>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
