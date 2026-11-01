import React from 'react';
import Icon from './Icon';
import { Button } from './Actions';
import { cn } from '../../lib/utils';

/** Inside buttons only. Pages load with skeletons. */
export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg aria-hidden="true" className={cn('size-5 animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const Skeleton: React.FC<{ className?: string; variant?: 'text' | 'row' | 'card' | 'chart' }> = ({ className, variant = 'text' }) => (
  <div
    aria-hidden="true"
    className={cn(
      'crystal-skeleton bg-inset',
      variant === 'text' && 'h-4 rounded-[var(--radius-sm)]',
      variant === 'row' && 'h-14 rounded-[var(--radius-md)]',
      variant === 'card' && 'h-36 rounded-[var(--radius-xl)]',
      variant === 'chart' && 'h-[220px] rounded-[var(--radius-xl)] md:h-[280px] lg:h-[320px]',
      className
    )}
  />
);

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

/** An icon, one line on what belongs here, one action. Never an illustration. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'inbox', title, description, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
    <Icon name={icon} size={24} className="mb-3 text-muted" />
    <h3 className="type-card-title text-ink">{title}</h3>
    <p className="type-body mt-1 max-w-sm text-muted">{description}</p>
    {(actionLabel || secondaryActionLabel) && (
      <div className="mt-5 flex w-full flex-col items-center justify-center gap-2 md:flex-row">
        {actionLabel && onAction && <Button onPress={onAction} className="max-md:w-full">{actionLabel}</Button>}
        {secondaryActionLabel && onSecondaryAction && <Button variant="ghost" onPress={onSecondaryAction} className="max-md:w-full">{secondaryActionLabel}</Button>}
      </div>
    )}
  </div>
);

const BANNER_TONES = {
  info: { box: 'bg-inset', icon: 'info', color: 'text-primary', role: 'status' },
  attention: { box: 'bg-amber-soft', icon: 'warning', color: 'text-ink', role: 'status' },
  error: { box: 'bg-money-out-soft', icon: 'error_outline', color: 'text-ink', role: 'alert' },
} as const;

/** Page-level status, such as a bank connection needing attention. */
export const Banner: React.FC<{
  tone?: keyof typeof BANNER_TONES;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ tone = 'info', children, actionLabel, onAction, className }) => {
  const style = BANNER_TONES[tone];
  return (
    <div role={style.role} className={cn('flex flex-wrap items-center gap-2.5 rounded-[var(--radius-lg)] px-4 py-3 text-ink', style.box, className)}>
      <Icon name={style.icon} size={20} className={cn('shrink-0', style.color)} />
      <div className="type-body min-w-0 flex-1">{children}</div>
      {actionLabel && onAction && <Button size="sm" variant="secondary" onPress={onAction}>{actionLabel}</Button>}
    </div>
  );
};

/** What failed, and Try again. A section failing leaves the rest of the page working. */
export const ErrorState: React.FC<{
  scope?: 'section' | 'page';
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  onHome?: () => void;
  className?: string;
}> = ({ scope = 'section', title = "This didn't load", message = 'Something went wrong on our side. Your data is safe.', onRetry, onHome, className }) => (
  <div role="alert" className={cn('flex flex-col items-center px-6 text-center', scope === 'page' ? 'py-24' : 'py-10', className)}>
    <Icon name="error_outline" size={24} className="mb-3 text-money-out" />
    <h3 className={cn('text-ink', scope === 'page' ? 'type-section-title' : 'type-card-title')}>{title}</h3>
    <p className="type-body mt-1 max-w-sm text-muted">{message}</p>
    <div className="mt-4 flex gap-2">
      {onRetry && <Button variant="secondary" onPress={onRetry}>Try again</Button>}
      {onHome && <Button variant="ghost" onPress={onHome}>Go to Overview</Button>}
    </div>
  </div>
);

/** Autosave and sync are quiet: a line of text, announced politely. */
export const SyncStatus: React.FC<{ state: 'idle' | 'working' | 'failed'; children: React.ReactNode; className?: string }> = ({ state, children, className }) => (
  <p role="status" className={cn('type-caption inline-flex items-center gap-1.5', state === 'failed' ? 'text-money-out' : 'text-muted', className)}>
    {state === 'working' && <Spinner className="size-4" />}
    {state === 'failed' && <Icon name="error_outline" size={16} />}
    {children}
  </p>
);
