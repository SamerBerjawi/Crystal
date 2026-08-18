import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

interface QuickBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (periodInMonths: number) => void;
}

const QuickBudgetModal: React.FC<QuickBudgetModalProps> = ({ isOpen, onClose, onApply }) => {
  const [isVisible, setIsVisible] = useState(false);

  const options = [
    { label: "Replicate last month's spending", description: "Use previous month's exact expenses", months: 1, icon: "schedule" },
    { label: "Use average of previous 3 months", description: "Smooth out quarterly spikes", months: 3, icon: "view_timeline" },
    { label: "Use average of previous 6 months", description: "Half-year balanced trajectory", months: 6, icon: "date_range" },
    { label: "Use average of previous 12 months", description: "Full-year historical benchmark", months: 12, icon: "calendar_month" },
  ];

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleOptionClick = (months: number) => {
    onApply(months);
    handleClose();
  };

  if (!isOpen && !isVisible) return null;

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20 shadow-xs">
                <Icon name="auto_fix_high" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  Quick Create Budgets
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Synthesize targets from spending history
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

            <div className="p-4 bg-primary-500/10 text-primary-800 dark:text-primary-200 rounded-2xl flex items-start gap-3 text-xs border border-primary-500/20">
              <Icon name="info" className="text-primary-600 dark:text-primary-400 text-base shrink-0 mt-0.5" />
              <p className="leading-relaxed font-semibold">
                Automatically generate budget allocation targets based on your historical outflow records.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                Select Analysis Window
              </span>

              {options.map((option) => (
                <button
                  key={option.months}
                  onClick={() => handleOptionClick(option.months)}
                  className="w-full text-left p-4 rounded-2xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all flex items-center justify-between group active:scale-98"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 flex items-center justify-center text-primary-500 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      <Icon name={option.icon} className="text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors truncate">
                        {option.label}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <Icon name="chevron_right" className="text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all text-xl shrink-0" />
                </button>
              ))}
            </div>

          </div>

          {/* Sticky Bottom Actions */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex justify-end">
            <button 
              type="button" 
              onClick={handleClose} 
              className={`${BTN_SECONDARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default QuickBudgetModal;
