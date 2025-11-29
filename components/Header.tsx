
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
}

const Header: React.FC<HeaderProps> = ({ user, setSidebarOpen, theme, setTheme, currentPage, titleOverride }) => {
  return (
    <header className="flex-shrink-0 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl h-20 flex items-center sticky top-0 z-20 border-b border-black/5 dark:border-white/5 transition-all duration-300">
        <div className="flex items-center justify-between w-full px-6 md:px-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="text-light-text-secondary dark:text-dark-text-secondary md:hidden p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div>
                    <h1 className="text-2xl font-extrabold text-light-text dark:text-dark-text tracking-tight">
                        {titleOverride || currentPage}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Could add global search or notifications here later */}
                <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1 hidden sm:block"></div>
                <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
        </div>
    </header>
  );
};

export default Header;
