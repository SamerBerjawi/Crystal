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
    'bg-primary hover:bg-primary-hover text-on-primary',
  secondary:
    'bg-surface hover:bg-inset text-ink border border-line-strong',
  accent:
    'bg-primary-soft text-ink hover:border-primary border border-transparent',
  emerald:
    'bg-primary hover:bg-primary-hover text-on-primary',
  indigo:
    'bg-primary hover:bg-primary-hover text-on-primary',
  amber:
    'bg-amber text-on-amber hover:brightness-95',
  gold:
    'bg-amber text-on-amber hover:brightness-95',
  danger:
    'bg-money-out text-on-danger hover:brightness-95',
  ghost:
    'text-ink hover:bg-inset',
};

const sizeStyles: Record<HeaderButtonSize, string> = {
  default: 'h-10 pointer-coarse:h-11 px-[18px] text-sm rounded-full font-bold gap-2',
  sm: 'h-8 pointer-coarse:h-11 px-3 text-[.8125rem] rounded-full font-bold gap-1.5',
  lg: 'h-12 px-6 text-[.9375rem] rounded-full font-bold gap-2.5',
  icon: 'size-10 pointer-coarse:size-11 p-0 rounded-full justify-center',
  'icon-sm': 'size-8 pointer-coarse:size-11 p-0 rounded-full justify-center',
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
