
import React from 'react';
import { Theme } from '../types';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, className }) => {
  const effectiveTheme =
    theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light')
      : theme;

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  return (
    <AnimatedThemeToggler
      theme={effectiveTheme}
      onThemeChange={handleThemeChange}
      className={className || "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"}
    />
  );
};

export default ThemeToggle;
