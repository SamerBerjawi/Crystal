import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  zIndexClass?: string;
}

const Modal: React.FC<ModalProps> = ({ children, onClose, title, zIndexClass = 'z-50' }) => {
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 ${zIndexClass}`}
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-xl shadow-modal w-full max-w-lg border border-light-separator/50 dark:border-dark-separator/50"
        onClick={handleContentClick}
      >
        <header className="flex items-center justify-between p-4 border-b border-light-separator dark:border-dark-separator">
          <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">{title}</h2>
          <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;