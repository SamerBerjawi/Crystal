import React from 'react';
import Icon from './ui/Icon';
import { ICON_BUTTON_STYLE, ICON_BUTTON_SM_STYLE } from '../constants';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  ariaLabel: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'danger' | 'primary';
  className?: string;
}

/**
 * Standard Accessible Icon Button per Apple HIG (minimum 44x44px touch target).
 * Requires ariaLabel for accessibility compliance.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  ariaLabel,
  size = 'md',
  variant = 'default',
  className = '',
  onClick,
  disabled,
  ...props
}) => {
  const baseStyle = size === 'sm' ? ICON_BUTTON_SM_STYLE : ICON_BUTTON_STYLE;
  
  const variantStyles = {
    default: '',
    danger: 'hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400',
    primary: 'hover:bg-primary-500/10 text-primary-500 hover:text-primary-600 dark:hover:text-primary-400',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variantStyles[variant]} ${disabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      <Icon name={icon} className={size === 'sm' ? 'text-base' : 'text-lg'} />
    </button>
  );
};

export default IconButton;
