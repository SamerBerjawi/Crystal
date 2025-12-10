

import React from 'react';
// FIX: Add User to imports
import { Page, Theme, User } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  // FIX: Add user prop to fix type error in App.tsx
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
  return (
    <header className="flex-shrink-0 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-white/20 dark:border-white/5 h-20 flex items-center sticky top-0 z-20 transition-all duration-300">
        <div className="flex items-center justify-between w-full px-6 md:px-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="text-light-text-secondary dark:text-dark-text-secondary md:hidden p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div>
                    <h1 className="text-2xl font-extrabold text-light-text dark:text-dark-text tracking-tight drop-shadow-sm">
                        {titleOverride || currentPage}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Privacy Mode Toggle */}
                <button
                    onClick={togglePrivacyMode}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${isPrivacyMode ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-light-fill dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500'}`}
                    title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
                >
                    <span className="material-symbols-outlined text-xl">local_cafe</span>
                </button>

                <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1 hidden sm:block"></div>
                <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
        </div>
    </header>
  );
};

export default Header;