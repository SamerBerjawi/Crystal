import React from 'react';
import Icon from './ui/Icon';

export type HeaderButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'emerald'
  | 'indigo'
  | 'amber'
  | 'gold'
  | 'danger'
  | 'ghost';

export type HeaderButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';

export interface HeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HeaderButtonVariant;
  size?: HeaderButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<HeaderButtonVariant, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-500 text-white font-semibold shadow-md shadow-primary-600/20 border border-primary-500/30 dark:bg-primary-500 dark:hover:bg-primary-400',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white font-semibold border border-slate-200/80 dark:border-white/5',
  accent:
    'bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-semibold border border-primary-500/20',
  emerald:
    'bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-xs',
  indigo:
    'bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 dark:text-indigo-300 font-semibold border border-indigo-500/30 shadow-xs',
  amber:
    'bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300 font-semibold border border-amber-500/30 shadow-xs',
  gold:
    'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-bold shadow-md shadow-amber-500/20 border border-amber-400/40 active:scale-[0.98]',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-300 font-semibold border border-rose-500/30 shadow-xs',
  ghost:
    'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 font-semibold border border-transparent',
};

const sizeStyles: Record<HeaderButtonSize, string> = {
  default: 'min-h-[40px] sm:min-h-[44px] h-10 sm:h-11 px-3.5 sm:px-4 text-xs font-semibold rounded-xl gap-2',
  sm: 'min-h-[36px] h-9 px-3 text-xs font-semibold rounded-lg gap-1.5',
  lg: 'min-h-[44px] h-12 px-5 text-sm font-semibold rounded-xl gap-2.5',
  icon: 'min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] h-10 w-10 sm:h-11 sm:w-11 p-0 rounded-xl justify-center text-xs',
  'icon-sm': 'min-h-[36px] min-w-[36px] h-9 w-9 p-0 rounded-lg justify-center text-xs',
};

const HeaderButton = React.forwardRef<HTMLButtonElement, HeaderButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'default',
      icon,
      iconPosition = 'left',
      isLoading = false,
      className = '',
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center shrink-0 transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 whitespace-nowrap cursor-pointer';

    const appliedVariant = variantStyles[variant] || variantStyles.secondary;
    const appliedSize = sizeStyles[size] || sizeStyles.default;

    const showIcon = Boolean(icon || isLoading);
    const iconName = isLoading ? 'sync' : icon;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${appliedVariant} ${appliedSize} ${className}`}
        {...props}
      >
        {showIcon && iconPosition === 'left' && (
          <Icon name={iconName} className={`text-base leading-none shrink-0 ${ isLoading ? 'animate-spin' : '' }`} />
        )}
        {children && <span>{children}</span>}
        {showIcon && iconPosition === 'right' && (
          <Icon name={iconName} className={`text-base leading-none shrink-0 ${ isLoading ? 'animate-spin' : '' }`} />
        )}
      </button>
    );
  }
);

HeaderButton.displayName = 'HeaderButton';

export default HeaderButton;
