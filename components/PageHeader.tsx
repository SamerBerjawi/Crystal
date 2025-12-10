import React from 'react';

interface PageHeaderProps {
  markerIcon: string;
  markerLabel: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  markerIcon,
  markerLabel,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <header className={`flex flex-col md:flex-row gap-4 md:items-center md:justify-between ${className}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-300">
          <span className="material-symbols-outlined text-xl">{markerIcon}</span>
          <span>{markerLabel}</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{title}</h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-3xl">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
};

export default PageHeader;
