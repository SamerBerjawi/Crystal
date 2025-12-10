
import React from 'react';
import { Page, Theme, User } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  user: User;
  setSidebarOpen: (isOpen: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentPage: Page;
  titleOverride?: string;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, setSidebarOpen, theme, setTheme, currentPage, titleOverride, isPrivacyMode, togglePrivacyMode }) => {
  
  // Construct simplified breadcrumbs
  const breadcrumbs = [
      { label: 'Crystal', active: false },
      { label: currentPage, active: !titleOverride },
      ...(titleOverride ? [{ label: titleOverride, active: true }] : [])
  ];

  return (
    <header className="flex-shrink-0 bg-white/70 dark:bg-black/70 backdrop-blur-md border-b border-white/20 dark:border-white/5 h-16 flex items-center sticky top-0 z-20 transition-all duration-300">
        <div className="flex items-center justify-between w-full px-4 md:px-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="text-light-text-secondary dark:text-dark-text-secondary md:hidden p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                
                {/* Breadcrumbs */}
                <nav className="flex items-center text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.label}>
                            {index > 0 && <span className="mx-2 opacity-50">/</span>}
                            <span className={`${crumb.active ? 'text-light-text dark:text-dark-text font-bold' : 'opacity-80'}`}>
                                {crumb.label}
                            </span>
                        </React.Fragment>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                {/* Search Trigger (Visual Only for now) */}
                <div className="hidden md:flex items-center bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5 text-sm text-light-text-secondary dark:text-dark-text-secondary cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-48 group">
                    <span className="material-symbols-outlined text-lg mr-2 group-hover:text-primary-500 transition-colors">search</span>
                    <span>Search...</span>
                    <span className="ml-auto text-xs opacity-50 border border-current px-1 rounded">⌘K</span>
                </div>

                {/* Privacy Mode Toggle */}
                <button
                    onClick={togglePrivacyMode}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${isPrivacyMode ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10'}`}
                    title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
                >
                    <span className="material-symbols-outlined text-lg">visibility_off</span>
                </button>

                {/* Notification Bell (Visual) */}
                <button
                     className="w-9 h-9 rounded-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
                     title="Notifications"
                >
                    <span className="material-symbols-outlined text-lg">notifications</span>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black"></span>
                </button>

                <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1"></div>
                <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
        </div>
    </header>
  );
};

export default Header;
