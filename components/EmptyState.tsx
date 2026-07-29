import React from 'react';
import { motion } from 'motion/react';
import HeaderButton from './HeaderButton';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-3xl bg-white/60 dark:bg-gray-900/40 border border-black/5 dark:border-white/5 backdrop-blur-xl ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 flex items-center justify-center mb-4 text-primary-600 dark:text-primary-400">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {secondaryActionLabel && onSecondaryAction && (
            <HeaderButton variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </HeaderButton>
          )}
          {actionLabel && onAction && (
            <HeaderButton variant="primary" onClick={onAction}>
              {actionLabel}
            </HeaderButton>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default EmptyState;
