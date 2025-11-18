import React from 'react';
import Modal from './Modal';
import { BTN_SECONDARY_STYLE } from '../constants';

interface QuickBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (periodInMonths: number) => void;
}

const QuickBudgetModal: React.FC<QuickBudgetModalProps> = ({ isOpen, onClose, onApply }) => {
  const options = [
    { label: "Replicate last month's spending", months: 1 },
    { label: "Use average of previous 3 months", months: 3 },
    { label: "Use average of previous 6 months", months: 6 },
    { label: "Use average of previous 12 months", months: 12 },
  ];

  if (!isOpen) return null;

  const handleOptionClick = (months: number) => {
    onApply(months);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Quick Create Budgets">
      <div className="space-y-4">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          Automatically create or update your budgets based on your historical spending. This will overwrite existing budgets for any categories with spending in the selected period.
        </p>
        <div className="space-y-3 pt-2">
          {options.map((option) => (
            <button
              key={option.months}
              onClick={() => handleOptionClick(option.months)}
              className="w-full text-left p-4 rounded-lg bg-light-bg dark:bg-dark-bg hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium flex justify-between items-center group"
            >
              <span>{option.label}</span>
              <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickBudgetModal;
