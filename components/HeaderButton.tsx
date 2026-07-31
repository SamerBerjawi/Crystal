import React from 'react';
import Icon from './ui/Icon';

export type HeaderButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'emerald'
  | 'indigo'
  | 'amber'
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
    'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-light-text dark:text-dark-text font-semibold border border-black/5 dark:border-white/5',
  accent:
    'bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-semibold border border-primary-500/20',
  emerald:
    'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20',
  indigo:
    'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-semibold border border-indigo-500/20',
  amber:
    'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20',
  danger:
    'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20',
  ghost:
    'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 font-semibold border border-transparent',
};

const sizeStyles: Record<HeaderButtonSize, string> = {
  default: 'h-9 px-3.5 text-xs rounded-xl gap-2',
  sm: 'h-8 px-2.5 text-[11px] rounded-lg gap-1.5',
  lg: 'h-10 px-4 text-xs rounded-xl gap-2',
  icon: 'h-9 w-9 p-0 rounded-xl justify-center text-xs',
  'icon-sm': 'h-8 w-8 p-0 rounded-lg justify-center text-xs',
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
