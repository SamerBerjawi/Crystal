import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  zIndexClass?: string;
  size?: 'lg' | 'xl' | '2xl' | '3xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, title, zIndexClass = 'z-[9999]', size = 'lg' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Small timeout to allow mount before animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const sizeClasses = {
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
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
      className={`fixed inset-0 flex items-center justify-center bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm p-4 ${zIndexClass} transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div 
        className={`bg-white/95 dark:bg-gray-900/95 rounded-xl shadow-modal w-full ${sizeClasses[size]} transition-all duration-300 ease-in-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={handleContentClick}
      >
        <header className="flex items-center justify-between p-4 border-b border-light-separator dark:border-dark-separator">
          <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">{title}</h2>
          <button onClick={handleClose} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="p-4 sm:p-6 max-h-[85vh] md:max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;