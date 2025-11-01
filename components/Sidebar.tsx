import React, { useState } from 'react';
import { Page, Theme, User } from '../types';
import { NAV_ITEMS, FinauraLogo, NavItem } from '../constants';

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
  
  const navItems = NAV_ITEMS;


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
              ? 'bg-primary-500 text-white font-semibold shadow-md'
              : `text-light-text-secondary hover:bg-black/5 dark:text-dark-text-secondary dark:hover:bg-white/10`
          }`}
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
      <aside className={`fixed top-0 left-0 bottom-0 z-40 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'} border-r border-light-separator dark:border-dark-separator`}>
        <div className="flex items-center justify-center h-20 flex-shrink-0">
            <div className={`flex items-center transition-all duration-300 ${isSidebarCollapsed ? 'md:gap-0' : 'gap-3'}`}>
                <FinauraLogo theme={theme} />
                <span className={`text-2xl font-bold text-light-text dark:text-white transition-opacity duration-200 ${isSidebarCollapsed ? 'md:hidden md:opacity-0' : 'opacity-100'}`}>Finaura</span>
            </div>
        </div>
        <nav className={`flex-1 py-4 overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
          <ul className="space-y-2">
            {navItems.map((item) => renderNavItem(item))}
          </ul>
        </nav>
        <div className={`px-4 py-4 flex-shrink-0 border-t border-light-separator dark:border-dark-separator ${isSidebarCollapsed ? 'md:px-2' : ''}`}>
          <button
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden md:flex items-center gap-3 w-full p-3 rounded-lg text-light-text-secondary hover:bg-black/5 dark:text-dark-text-secondary dark:hover:bg-white/10 transition-colors duration-200 mb-2 ${isSidebarCollapsed ? 'md:justify-center' : ''}`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined">
              {isSidebarCollapsed ? 'side_navigation' : 'menu_open'}
            </span>
            <span className={`font-medium transition-opacity ${isSidebarCollapsed ? 'md:hidden md:opacity-0' : 'opacity-100'}`}>Collapse</span>
          </button>
          <button onClick={onLogout} className={`w-full flex items-center gap-3 p-3 rounded-lg text-light-text-secondary hover:bg-black/5 dark:text-dark-text-secondary dark:hover:bg-white/10 transition-colors duration-200 ${isSidebarCollapsed ? 'md:justify-center' : ''}`} title={isSidebarCollapsed ? 'Logout' : 'Logout'}>
            <span className="material-symbols-outlined">logout</span>
            <span className={`font-medium transition-opacity ${isSidebarCollapsed ? 'md:hidden md:opacity-0' : 'opacity-100'}`}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;