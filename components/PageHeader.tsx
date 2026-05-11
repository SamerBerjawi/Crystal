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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black text-primary-600 dark:text-primary-400">
          <span className="material-symbols-outlined text-base leading-none">{markerIcon}</span>
          <span className="leading-none">{markerLabel}</span>
        </div>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-black text-light-text dark:text-dark-text tracking-tight leading-tight">{title}</h1>
          <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary max-w-3xl opacity-60 leading-tight">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
};

export default PageHeader;
