import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CHECKBOX_STYLE, INPUT_BASE_STYLE } from '../constants';
import Icon from './ui/Icon';

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
    <div ref={wrapperRef} className="relative w-auto font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="touch-feedback inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-dark-card/90 border border-black/10 dark:border-white/10 shadow-xs text-xs font-semibold text-light-text dark:text-white min-h-[38px] min-w-[9.5rem] transition-all hover:bg-white dark:hover:bg-dark-card active:scale-95 text-left"
      >
        <span className="truncate max-w-[11rem]">{buttonText}</span>
        <Icon name="expand_more" className={`text-sm text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[15rem] bg-white/95 dark:bg-[#1e1f23]/95 backdrop-blur-2xl rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl z-50 p-3 overflow-hidden animate-fade-in-up">
          {/* iOS Search Input */}
          <div className="relative mb-2.5">
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 pl-7 pr-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/5 dark:border-white/5 text-[11px] font-medium text-light-text dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold px-1 mb-2 text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-primary-600 dark:text-primary-400 hover:underline normal-case text-[11px]"
            >
              {selectedValues.length === options.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="font-mono">{selectedValues.length} / {options.length}</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-0.5 scroll-touch">
            {filteredOptions.map(option => {
              const isChecked = selectedValues.includes(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all active:scale-[0.99] ${
                    isChecked
                      ? 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-semibold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-light-text dark:text-gray-200'
                  }`}
                  style={{ paddingLeft: `${8 + (option.level || 0) * 12}px` }}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-black/20 dark:border-white/20 bg-transparent'
                      }`}
                    >
                      {isChecked && <Icon name="check" className="text-xs text-white" />}
                    </div>
                    <span className="text-xs truncate">{option.label}</span>
                  </div>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="text-center text-xs py-4 text-gray-400">No results found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;