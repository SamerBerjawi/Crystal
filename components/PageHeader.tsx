import React from 'react';
import { cn } from '../lib/utils';

export interface PageHeaderProps {
  /** Older pages still pass these. The new header has no marker, and they go as each page is rebuilt. */
  markerIcon?: string;
  markerLabel?: string;
  markerClassName?: string;
  accentColor?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Title and actions in one row. Search and notifications now live in the app's top bar. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className }) => (
  <header className={cn('mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="type-page-title text-ink">{title}</h1>
      {subtitle && <p className="type-body mt-1 max-w-3xl text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
  </header>
);

export const HeroHeader = PageHeader;
export default PageHeader;
