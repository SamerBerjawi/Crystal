import React, { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import Icon from './ui/Icon';
import { CLOSE_BTN_STYLE, Z_INDEX } from '../constants';
import { useDialogA11y, isTopmostDialog } from '../hooks/useDialogA11y';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  zIndexClass?: string;
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
}

/**
 * Responsive Modal — Apple HIG Sheet on mobile / Glassmorphic Floating Window on desktop.
 */
const Modal: React.FC<ModalProps> = ({ children, onClose, title, zIndexClass = Z_INDEX.MODAL, size = 'lg' }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(true);
  const titleId = useId();
  const dialogRef = useDialogA11y<HTMLDivElement>();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle ESC key: with stacked dialogs only the topmost one closes.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmostDialog(dialogRef.current)) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sizeClasses = {
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <div 
      className={`fixed inset-0 flex items-end md:items-center justify-center md:p-4 scrim ${zIndexClass} transition-opacity duration-[var(--duration-medium)] font-sans ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Modal Container */}
      <div 
        className={`
          bg-surface text-ink shadow-lg w-full overflow-hidden focus:outline-none relative flex flex-col
          transition-[transform,opacity] duration-[var(--duration-medium)] ease-[var(--ease-standard)]
          rounded-t-[var(--radius-2xl)] md:rounded-[var(--radius-xl)]
          max-h-[92dvh] md:max-h-[90dvh]
          ${sizeClasses[size]}
          ${isVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full md:translate-y-2 opacity-0'
          }
        `}
        onClick={handleContentClick}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-line-strong" />
        </div>

        {/* Header */}
        <header className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <h2 id={titleId} className="type-section-title text-ink truncate">
              {title}
            </h2>
          </div>
          <button 
            onClick={handleClose} 
            className={CLOSE_BTN_STYLE}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="px-6 pb-6 min-h-0 flex-1 overflow-y-auto scroll-touch safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;