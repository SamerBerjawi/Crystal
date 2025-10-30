import React from 'react';
import { Page, Theme, User } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  user: User;
  setSidebarOpen: (isOpen: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentPage: Page;
}

const Header: React.FC<HeaderProps> = ({ user, setSidebarOpen, theme, setTheme, currentPage }) => {
  return (
    <header className="flex-shrink-0 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-xl h-20 flex items-center border-b border-light-separator dark:border-dark-separator sticky top-0 z-20">
        <div className="flex items-center justify-between w-full px-4 md:px-8">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="text-light-text-secondary dark:text-dark-text-secondary md:hidden">
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{currentPage.replace(' & ', ' & ')}</h1>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle theme={theme} setTheme={setTheme} />
                <img className="h-10 w-10 rounded-full object-cover" src={user.profilePictureUrl} alt="User" />
            </div>
        </div>
    </header>
  );
};

export default Header;
