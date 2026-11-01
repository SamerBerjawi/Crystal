import React from 'react';
import { Page } from '../types';
import PageHeader, { type PageStat } from './PageHeader';
import SettingSearch from './SettingSearch';

interface SettingsSubpageHeaderProps {
  title: string;
  subtitle?: string;
  stats?: PageStat[];
  markerIcon?: string;
  markerLabel?: string;
  accentColor?: 'primary' | 'amber' | 'emerald' | 'indigo' | 'cyan' | 'rose' | 'purple' | 'teal' | 'orange';
  actions?: React.ReactNode;
  setCurrentPage?: (page: Page) => void;
  className?: string;
}

/** The header of every Settings page. "Find a setting" stands in for the old tile page (D-045). */
const SettingsSubpageHeader: React.FC<SettingsSubpageHeaderProps> = ({ title, subtitle, stats, actions, setCurrentPage, className = '' }) => (
  <PageHeader
    title={title}
    subtitle={subtitle}
    stats={stats}
    className={className}
    actions={(actions || setCurrentPage) && (
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
        {setCurrentPage && <SettingSearch setCurrentPage={setCurrentPage} />}
        {actions}
      </div>
    )}
  />
);

export default SettingsSubpageHeader;
