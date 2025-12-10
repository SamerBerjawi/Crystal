
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

  const isDark = effectiveTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 bg-transparent text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
};

export default ThemeToggle;
