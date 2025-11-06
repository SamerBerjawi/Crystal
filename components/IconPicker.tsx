import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { INPUT_BASE_STYLE } from '../constants';

interface IconPickerProps {
  onClose: () => void;
  onSelect: (icon: string) => void;
  iconList: string[];
}

const IconPicker: React.FC<IconPickerProps> = ({ onClose, onSelect, iconList }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleIconClick = (icon: string) => {
    onSelect(icon);
    onClose();
  };

  const displayedIcons = useMemo(() => {
    const searchTermTrimmed = searchTerm.toLowerCase().trim();

    if (!searchTermTrimmed) {
      return iconList;
    }

    const filteredFromList = iconList.filter(icon =>
      icon.toLowerCase().includes(searchTermTrimmed)
    );

    // If user types a valid icon name not in the list, show it first
    if (!filteredFromList.includes(searchTermTrimmed) && searchTermTrimmed.length > 2) {
      return [searchTermTrimmed, ...filteredFromList];
    }
    
    return filteredFromList;
  }, [searchTerm, iconList]);

  return (
    <Modal onClose={onClose} title="Select an Icon" zIndexClass="z-[60]">
      <div className="space-y-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search icons..."
            className={`${INPUT_BASE_STYLE} pl-10`}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-6 gap-4 max-h-80 overflow-y-auto pr-2">
          {displayedIcons.map(icon => (
            <button
              key={icon}
              onClick={() => handleIconClick(icon)}
              className="flex items-center justify-center p-3 bg-light-bg dark:bg-dark-bg rounded-lg shadow-neu-raised-light dark:shadow-neu-raised-dark hover:shadow-neu-inset-light dark:hover:shadow-neu-inset-dark transition-shadow text-light-text dark:text-dark-text"
              aria-label={icon}
              title={icon}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '29px' }}>
                {icon}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default IconPicker;