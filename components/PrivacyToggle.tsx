import React from 'react';

interface PrivacyToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

const PrivacyToggle: React.FC<PrivacyToggleProps> = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label="Toggle privacy mode"
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-transparent hover:border-black/10 dark:hover:border-white/10 shadow-sm ${
        enabled
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200'
          : 'bg-light-fill dark:bg-dark-fill text-light-text-secondary dark:text-dark-text-secondary'
      }`}
    >
      <span className={`${enabled ? 'material-symbols-filled' : 'material-symbols-outlined'} text-xl`}>
        local_cafe
      </span>
    </button>
  );
};

export default PrivacyToggle;
