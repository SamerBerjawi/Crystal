import React from 'react';
import { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const effectiveTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  const toggleTheme = () => {
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="w-14 h-8 rounded-full p-1 bg-light-fill dark:bg-dark-fill flex items-center transition-colors duration-300"
      aria-label="Toggle theme"
    >
      <div
        className={`w-6 h-6 rounded-full bg-light-card dark:bg-dark-card shadow-lg transform transition-transform duration-300 flex items-center justify-center ${
          effectiveTheme === 'dark' ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        <span className="material-symbols-outlined text-sm text-primary-500">
            {effectiveTheme === 'light' ? 'light_mode' : 'dark_mode'}
        </span>
      </div>
    </button>
  );
};

export default ThemeToggle;