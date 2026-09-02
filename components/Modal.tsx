import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './ui/Icon';
import { CLOSE_BTN_STYLE, Z_INDEX } from '../constants';

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

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
      className={`fixed inset-0 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 ${zIndexClass} transition-opacity duration-300 font-sans ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Modal Container */}
      <div 
        className={`
          bg-light-card dark:bg-dark-card border border-black/10 dark:border-white/10 shadow-2xl w-full overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] relative
          
          /* Mobile: slide-up sheet | Desktop: rounded floating glass card */
          rounded-t-[32px] md:rounded-[2rem]
          max-h-[95vh] md:max-h-[90vh]
          ${sizeClasses[size]}
          
          ${isVisible 
            ? 'translate-y-0 md:translate-y-0 md:scale-100 opacity-100' 
            : 'translate-y-full md:translate-y-0 md:scale-95 opacity-0'
          }
        `}
        onClick={handleContentClick}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
        </div>

        {/* Ambient Top Gradient Glow */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-primary-500/10 via-primary-500/5 to-transparent pointer-events-none -z-1" />

        {/* Header */}
        <header className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
              {title}
            </h2>
          </div>
          <button 
            onClick={handleClose} 
            className={CLOSE_BTN_STYLE}
            aria-label="Close modal"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="p-6 max-h-[calc(95vh-100px)] md:max-h-[calc(90vh-80px)] overflow-y-auto custom-scrollbar scroll-touch safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;