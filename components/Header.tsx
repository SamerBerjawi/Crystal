import React, { useState, useEffect } from 'react';
import { Page, Theme, User } from '../types';
import ThemeToggle from './ThemeToggle';
import { formatRelativeTime } from '../utils';

interface HeaderProps {
  user: User;
  setSidebarOpen: (isOpen: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentPage: Page;
  titleOverride?: string;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

const Header: React.FC<HeaderProps> = ({ user, setSidebarOpen, theme, setTheme, currentPage, titleOverride, isSyncing, lastSyncTime }) => {
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(lastSyncTime));

  useEffect(() => {
    // Update relative time every 10 seconds to keep it fresh
    const intervalId = setInterval(() => {
      setRelativeTime(formatRelativeTime(lastSyncTime));
    }, 10000);
    return () => clearInterval(intervalId);
  }, [lastSyncTime]);
  
  // Update immediately when sync status changes
  useEffect(() => {
    setRelativeTime(formatRelativeTime(lastSyncTime));
  }, [lastSyncTime, isSyncing]);

  return (
    <header className="flex-shrink-0 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl h-20 flex items-center border-b border-light-separator dark:border-dark-separator sticky top-0 z-20">
        <div className="flex items-center justify-between w-full px-4 md:px-8">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="text-light-text-secondary dark:text-dark-text-secondary md:hidden">
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{titleOverride || currentPage.replace(' & ', ' & ')}</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {isSyncing ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Syncing...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-base text-green-500">check_circle</span>
                            <span>Last sync: {relativeTime}</span>
                        </>
                    )}
                </div>
                <ThemeToggle theme={theme} setTheme={setTheme} />
                <img className="h-10 w-10 rounded-full object-cover" src={user.profilePictureUrl} alt="User" />
            </div>
        </div>
    </header>
  );
};

export default Header;