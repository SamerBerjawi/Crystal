import React from 'react';
import { Duration } from '../types';
import { SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, DURATION_OPTIONS } from '../constants';

interface DurationFilterProps {
  selectedDuration: Duration;
  onDurationChange: (duration: Duration) => void;
}

const DurationFilter: React.FC<DurationFilterProps> = ({ selectedDuration, onDurationChange }) => {
  return (
    <div className={SELECT_WRAPPER_STYLE}>
      <select
        value={selectedDuration}
        onChange={(e) => onDurationChange(e.target.value as Duration)}
        className={SELECT_STYLE}
      >
        {DURATION_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className={SELECT_ARROW_STYLE}>
         <span className="material-symbols-outlined text-base">expand_more</span>
      </div>
    </div>
  );
};

export default DurationFilter;