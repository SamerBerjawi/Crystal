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
    <header className="flex-shrink-0 bg-light-card dark:bg-dark-card h-20 flex items-center sticky top-0 z-20">
        <div className="flex items-center justify-between w-full px-4 md:px-8">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="text-light-text-secondary dark:text-dark-text-secondary md:hidden">
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{titleOverride || currentPage.replace(' & ', ' & ')}</h1>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
        </div>
    </header>
  );
};

export default Header;