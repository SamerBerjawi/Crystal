import React from 'react';
import { motion } from 'motion/react';
import Icon from './ui/Icon';

interface FloatingActionButtonProps {
  /** Material Symbols icon name */
  icon?: string;
  /** Callback when the FAB is tapped */
  onClick: () => void;
  /** Label for accessibility */
  label?: string;
  /** Background color class (default: primary gradient) */
  colorClass?: string;
  /** Whether the FAB is visible (for conditional rendering with animation) */
  visible?: boolean;
}

/**
 * Floating Action Button — Apple HIG + Material Design hybrid.
 *
 * Positioned above the mobile tab bar with safe-area awareness.
 * Circular button with a subtle shadow, spring entrance animation,
 * and haptic-like tap feedback.
 */
const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon = 'add',
  onClick,
  label = 'Quick action',
  colorClass = 'bg-primary-500 hover:bg-primary-600 text-white',
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        md:hidden fixed z-[45]
        w-14 h-14 min-w-[56px] min-h-[56px]
        rounded-full
        flex items-center justify-center
        fab-shadow
        touch-feedback
        ${colorClass}
      `}
      style={{
        right: '1.25rem',
        bottom: `calc(5.5rem + env(safe-area-inset-bottom, 0px))`,
      }}
      aria-label={label}
    >
      <Icon name={icon} className="text-2xl" />
    </motion.button>
  );
};

export default FloatingActionButton;
