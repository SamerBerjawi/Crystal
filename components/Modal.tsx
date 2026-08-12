import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './ui/Icon';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  zIndexClass?: string;
  size?: 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
}

/**
 * Responsive Modal — Apple HIG Sheet on mobile.
 *
 * Desktop: Centered floating dialog with backdrop blur (unchanged behaviour).
 * Mobile:  Full-screen sheet that slides up from the bottom with a drag handle,
 *          following Apple HIG modal presentation guidelines.
 */
const Modal: React.FC<ModalProps> = ({ children, onClose, title, zIndexClass = 'z-[9999]', size = 'lg' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Small timeout to allow mount before animation
    const timer = setTimeout(() => setIsVisible(true), 10);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
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
    setTimeout(onClose, 300); // Animation duration
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <div 
      className={`fixed inset-0 flex items-end md:items-center justify-center bg-gray-900/40 dark:bg-black/80 backdrop-blur-md md:p-4 ${zIndexClass} transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Mobile: Full-height sheet from bottom | Desktop: Centered dialog */}
      <div 
        className={`
          bg-white/95 dark:bg-gray-900/95 ios-regular shadow-modal w-full overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]
          
          /* Mobile: slide-up sheet */
          rounded-t-[28px] md:rounded-3xl
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
        <div className="flex justify-center pt-2.5 pb-0 md:hidden" aria-hidden="true">
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <header className="flex items-center justify-between p-4 sm:p-5 border-b border-light-separator dark:border-dark-separator shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate pr-2">{title}</h2>
          <button 
            onClick={handleClose} 
            className="touch-feedback text-light-text-secondary dark:text-dark-text-secondary w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            aria-label="Close modal"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </header>
        <div className="p-4 sm:p-6 max-h-[calc(95vh-100px)] md:max-h-[calc(90vh-70px)] overflow-y-auto scroll-touch safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;