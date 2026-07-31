
import React from 'react';
import { AnimatedThemeToggler, type TransitionVariant } from '@/components/ui/animated-theme-toggler';
import { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  className?: string;
  variant?: TransitionVariant;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, className, variant = "circle" }) => {
  const effectiveTheme: "light" | "dark" =
    theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light')
      : (theme === 'dark' ? 'dark' : 'light');

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
  };

  return (
    <AnimatedThemeToggler
      theme={effectiveTheme}
      onThemeChange={handleThemeChange}
      variant={variant}
      duration={450}
      className={className || "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 [&_svg]:size-4.5 cursor-pointer"}
    />
  );
};

export default ThemeToggle;

