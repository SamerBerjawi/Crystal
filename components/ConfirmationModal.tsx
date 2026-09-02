import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import HeaderButton from './HeaderButton';
import Icon from './ui/Icon';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'danger';
  /** New optional props for richer variants */
  variant?: 'danger' | 'warning' | 'info';
  icon?: string;
  cancelButtonText?: string;
}

const variantConfig = {
  danger: {
    icon: 'warning',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    buttonVariant: 'danger' as const,
  },
  warning: {
    icon: 'error_outline',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    buttonVariant: 'amber' as const,
  },
  info: {
    icon: 'info',
    iconBg: 'bg-primary-500/10',
    iconColor: 'text-primary-500',
    buttonVariant: 'primary' as const,
  },
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  confirmButtonVariant,
  variant = 'danger',
  icon,
  cancelButtonText = 'Cancel',
}) => {
  // Focus trap: focus the cancel button on mount
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => cancelRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const config = variantConfig[variant] || variantConfig.danger;
  const displayIcon = icon || config.icon;

  // Determine the HeaderButton variant for the confirm button
  const resolvedButtonVariant = confirmButtonVariant === 'primary'
    ? 'primary'
    : confirmButtonVariant === 'danger'
      ? 'danger'
      : config.buttonVariant;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 z-[99999]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-light-card dark:bg-dark-card border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Accent Glow */}
            <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${config.iconBg} to-transparent pointer-events-none -z-1 opacity-50`} />

            <div className="p-6 pt-8 flex flex-col items-center text-center gap-4">
              {/* Icon */}
              <Icon name={displayIcon} className={`text-4xl ${config.iconColor}`} />

              {/* Title & Message */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">
                  {title}
                </h3>
                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 pt-0 px-6 pb-6">
              <HeaderButton
                ref={cancelRef}
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={onClose}
              >
                {cancelButtonText}
              </HeaderButton>
              <HeaderButton
                variant={resolvedButtonVariant}
                size="lg"
                className="flex-1"
                onClick={() => { onConfirm(); onClose(); }}
              >
                {confirmButtonText}
              </HeaderButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ── Imperative confirm hook ──
// Global state for the imperative confirm dialog
let globalShowConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

export const useConfirm = () => {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ isOpen: true, options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleClose = useCallback(() => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = useCallback(() => (
    <ConfirmationModal
      isOpen={state.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.options.title}
      message={state.options.message}
      confirmButtonText={state.options.confirmLabel || 'Confirm'}
      cancelButtonText={state.options.cancelLabel || 'Cancel'}
      variant={state.options.variant || 'danger'}
      icon={state.options.icon}
    />
  ), [state.isOpen, state.options, handleClose, handleConfirm]);

  return { confirm, ConfirmDialog };
};

export default ConfirmationModal;