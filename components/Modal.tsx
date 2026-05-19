import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  zIndexClass?: string;
  size?: 'lg' | 'xl' | '2xl' | '3xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, title, zIndexClass = 'z-[9999]', size = 'lg' }) => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sizeClasses = {
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <AnimatePresence>
      <div 
        className={`fixed inset-0 flex ${isMobile ? 'items-end' : 'items-center'} justify-center bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm ${zIndexClass}`}
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <motion.div 
          initial={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
          animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, duration: 0.3 }}
          className={`bg-white/95 dark:bg-gray-900/95 shadow-modal w-full ${isMobile ? 'rounded-t-[2.5rem] rounded-b-none max-h-[92vh]' : `${sizeClasses[size]} rounded-[2rem] mx-4`} transition-all duration-300 ease-in-out relative flex flex-col`}
          onClick={handleContentClick}
        >
          {isMobile && (
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />
          )}
          <header className={`flex items-center justify-between p-4 ${isMobile ? 'pt-2 pb-4' : 'border-b border-light-separator dark:border-dark-separator'}`}>
            <h2 className="text-lg font-black text-light-text dark:text-dark-text tracking-tight ml-2">{title}</h2>
            <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined leading-none">close</span>
            </button>
          </header>
          <div className={`p-4 sm:p-6 overflow-y-auto ${isMobile ? 'pb-12' : 'max-h-[85vh] md:max-h-[80vh]'}`}>
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
