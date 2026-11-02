import React from 'react';
import { cn } from '../lib/utils';

interface SettingsGroupProps {
  id?: string;
  title: string;
  description?: string;
  /** For content that brings its own cards. */
  isPlain?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** One topic on a settings page: its title and subtitle above, its controls in a full-width card below. */
const SettingsGroup: React.FC<SettingsGroupProps> = ({ id, title, description, isPlain, className, children }) => (
  <section id={id} className={cn('scroll-mt-24 space-y-3', className)}>
    <div className="min-w-0">
      <h2 className="type-card-title text-ink">{title}</h2>
      {description && <p className="type-body mt-1 text-muted">{description}</p>}
    </div>
    <div className={cn('w-full min-w-0', !isPlain && 'rounded-[var(--radius-xl)] surface-card p-5')}>{children}</div>
  </section>
);

export default SettingsGroup;
