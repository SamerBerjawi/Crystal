import React from 'react';
import { Duration } from '../types';
import { DURATION_OPTIONS } from '../constants';
import { Select } from './ui/Pickers';

interface DurationFilterProps {
  selectedDuration: Duration;
  onDurationChange: (duration: Duration) => void;
}

const OPTIONS = DURATION_OPTIONS.map(option => ({ id: option.value, label: option.label }));

const DurationFilter: React.FC<DurationFilterProps> = ({ selectedDuration, onDurationChange }) => (
  <Select variant="chip" label="Time period" options={OPTIONS} value={selectedDuration} onChange={id => onDurationChange(id as Duration)} />
);

export default DurationFilter;
