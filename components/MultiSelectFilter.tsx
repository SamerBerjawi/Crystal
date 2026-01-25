
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CHECKBOX_STYLE, INPUT_BASE_STYLE } from '../constants';

interface Option {
  value: string;
  label: string;
  level?: number;
}

interface MultiSelectFilterProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ options, selectedValues, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => 
    options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase())),
  [options, searchTerm]);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleToggleAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };
  
  const buttonText = selectedValues.length === 0 ? placeholder 
    : selectedValues.length === 1 ? options.find(o => o.value === selectedValues[0])?.label || '1 selected'
    : `${selectedValues.length} selected`;

  return (
    <div ref={wrapperRef} className="relative w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${INPUT_BASE_STYLE} !w-auto min-w-[10rem] flex items-center justify-between text-left whitespace-nowrap bg-light-fill/80 dark:bg-dark-fill/80 backdrop-blur-md transition-all duration-200`}
      >
        <span className="mr-2 truncate max-w-[12rem]">{buttonText}</span>
        <span className={`material-symbols-outlined transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[14rem] bg-light-card/95 dark:bg-dark-card/95 backdrop-blur-xl rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-50 p-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className={`${INPUT_BASE_STYLE} mb-2`}
            autoFocus
          />
          <div className="flex justify-between items-center text-xs px-2 mb-1">
            <button type="button" onClick={handleToggleAll} className="font-semibold text-primary-500 hover:underline">
              {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-light-text-secondary dark:text-dark-text-secondary">{selectedValues.length} / {options.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => handleToggle(option.value)}
                  className={CHECKBOX_STYLE}
                />
                <span className="text-sm" style={{ paddingLeft: `${(option.level || 0) * 12}px` }}>
                  {option.label}
                </span>
              </label>
            ))}
             {filteredOptions.length === 0 && <p className="text-center text-xs p-4 text-light-text-secondary dark:text-dark-text-secondary">No results found.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
