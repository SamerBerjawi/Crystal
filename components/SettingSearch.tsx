import React, { useMemo } from 'react';
import type { Page } from '../types';
import { SETTINGS_INDEX } from '../utils/settingsIndex';
import { Combobox } from './ui/Pickers';

const FIND_ATTEMPTS = 40;
const FIND_INTERVAL_MS = 50;

/** Pages load lazily, so keep looking for a moment after moving to one. */
const scrollToAnchor = (anchor: string, attempt = 0) => {
  const target = document.getElementById(anchor);
  if (target) {
    target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return;
  }
  if (attempt < FIND_ATTEMPTS) window.setTimeout(() => scrollToAnchor(anchor, attempt + 1), FIND_INTERVAL_MS);
};

const SettingSearch: React.FC<{ setCurrentPage: (page: Page) => void }> = ({ setCurrentPage }) => {
  const options = useMemo(() => SETTINGS_INDEX.map(entry => ({ id: entry.id, label: entry.label, description: entry.where })), []);

  const open = (id: string | null) => {
    const entry = SETTINGS_INDEX.find(item => item.id === id);
    if (!entry) return;
    setCurrentPage(entry.page);
    if (entry.anchor) scrollToAnchor(entry.anchor);
  };

  return (
    <Combobox
      label={<span className="sr-only">Find a setting</span>}
      placeholder="Find a setting"
      options={options}
      value={null}
      onChange={open}
      className="w-full md:w-64"
    />
  );
};

export default SettingSearch;
