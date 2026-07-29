
import React from 'react';
import { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, className }) => {
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
      className={className || "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <span className="material-symbols-outlined text-[19px]">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
};

export default ThemeToggle;
