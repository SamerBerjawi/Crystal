import React, { useState, useRef, useEffect } from 'react';
import { Page, Theme, User } from '../types';
import { NAV_ITEMS, CrystalLogo, NavItem } from '../constants';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  theme: Theme;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  onLogout: () => void;
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isSidebarOpen, setSidebarOpen, theme, isSidebarCollapsed, setSidebarCollapsed, onLogout, user }) => {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(() => {
    const activeParent = NAV_ITEMS.find(item => item.subItems?.some(sub => sub.name === currentPage));
    return activeParent ? activeParent.name : null;
  });
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const navItems = NAV_ITEMS;

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
        // Toggle the submenu to be open once the sidebar expands
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

    const iconEl = (
        <span className={`material-symbols-outlined ${(isActive || isParentActive) ? 'material-symbols-filled' : ''} transition-transform duration-200 group-hover:scale-110`}>
            {item.icon}
        </span>
    );

    if (item.subItems) {
      return (
        <li key={item.name} title={isSidebarCollapsed ? item.name : undefined}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick(item.name, true);
            }}
            className={`group flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${
              isParentActive ? 'text-primary-600 font-semibold dark:text-primary-300 bg-primary-500/10' : 'text-light-text-secondary hover:bg-black/5 dark:text-dark-text-secondary dark:hover:bg-white/10'
            } ${isSidebarCollapsed ? 'md:px-2' : ''}`}
          >
            <div className={`flex items-center ${isSidebarCollapsed ? 'md:w-full md:justify-center' : 'gap-3'}`}>
              {iconEl}
              <span className={`font-medium transition-opacity ${isSidebarCollapsed ? 'md:hidden' : ''}`}>{item.name}</span>
            </div>
            <span className={`material-symbols-outlined transition-transform duration-300 ${isSubMenuOpen ? 'rotate-180' : ''} ${isSidebarCollapsed ? 'md:hidden' : ''}`}>expand_more</span>
          </a>
          {isSubMenuOpen && !isSidebarCollapsed && (
            <ul className="pl-4 pt-1 space-y-1">
              {item.subItems.map(sub => renderNavItem(sub, true))}
            </ul>
          )}
        </li>
      );
    }

    return (
      <li key={item.name} title={isSidebarCollapsed ? item.name : undefined}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick(item.name);
          }}
          className={`group flex items-center p-3 rounded-lg transition-colors duration-200 ${ isSidebarCollapsed ? `md:px-2 md:justify-center md:gap-0` : `px-3 gap-3 ${isSubItem ? 'pl-7' : ''}`} ${
            isActive
              ? 'text-white font-semibold shadow-md'
              : `text-light-text-secondary hover:bg-black/5 dark:text-dark-text-secondary dark:hover:bg-white/10`
          }`}
          style={isActive ? { background: 'linear-gradient(140deg,rgba(255, 149, 0, 1) 28%, rgba(253, 29, 29, 1) 100%)' } : {}}
        >
          {iconEl}
          <span className={`font-medium transition-opacity ${isSidebarCollapsed ? 'md:hidden' : ''}`}>{item.name}</span>
        </a>
      </li>
    );
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-light-card dark:bg-dark-card flex flex-col transition-all duration-300 ease-in-out md:relative md:h-screen md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div className={`flex items-center h-20 flex-shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'md:px-3 justify-center' : 'px-4 justify-between'}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'w-auto' : 'w-full'}`}>
                <CrystalLogo showText={false} />
                <span className={`font-bold text-xl transition-opacity ${isSidebarCollapsed ? 'md:hidden md:opacity-0' : 'opacity-100'}`}>Crystal</span>
            </div>
            <div className="flex items-center">
                 <button
                    onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                    className={`hidden md:flex items-center justify-center p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${isSidebarCollapsed ? 'hidden' : ''}`}
                    title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <span className="material-symbols-outlined">
                        menu_open
                    </span>
                </button>
            </div>
        </div>
        <nav className={`flex-1 min-h-0 py-4 overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
          <ul className="space-y-2">
            {navItems.map((item) => renderNavItem(item))}
          </ul>
        </nav>
        <div ref={profileMenuRef} className={`relative px-4 py-3 mt-auto border-t border-black/5 dark:border-white/10 ${isSidebarCollapsed ? 'md:px-2' : ''}`}>
          {isProfileMenuOpen && (
            <div className="animate-fade-in-up absolute bottom-full left-2 right-2 mb-2 bg-light-card dark:bg-dark-card rounded-lg shadow-lg border border-black/10 dark:border-white/10 py-2 z-10">
              <button
                onClick={() => { setCurrentPage('Personal Info'); setProfileMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span>Personal Info</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 text-semantic-red hover:bg-semantic-red/10"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>Logout</span>
              </button>
            </div>
          )}
          <button
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${isSidebarCollapsed ? 'md:justify-center' : ''}`}
            title="Profile options"
          >
            <img className="h-9 w-9 rounded-full object-cover flex-shrink-0" src={user.profilePictureUrl} alt="User" />
            <div className={`flex-grow text-left overflow-hidden transition-all ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
              <p className="font-semibold text-sm truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{user.email}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;