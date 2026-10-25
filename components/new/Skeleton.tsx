import React from 'react';
import { cn } from '../../lib/utils';

/*
 * Loading placeholders for the New pages (UI_UX_DESIGN_REFERENCE.md D15): `nv-surface` cards with pulsing
 * `nv-line` bones, shaped like the page that is loading. No shimmer, no glass.
 */

export const Bone: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-full bg-nv-line', className)} aria-hidden />
);

const CardShell: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('rounded-nv-card bg-nv-tile p-5 sm:p-6', className)}>{children}</div>
);

const Tiles = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    {[0, 1, 2].map(i => (
      <CardShell key={i} className="flex items-center gap-4">
        <Bone className="h-10 w-10" />
        <div className="flex-1 space-y-2"><Bone className="h-6 w-24" /><Bone className="h-3 w-16" /></div>
      </CardShell>
    ))}
  </div>
);

export type SkeletonShape = 'dashboard' | 'list' | 'detail';

/** A content-shaped placeholder for a page while its chunk or data loads. */
export const PageSkeletonNew: React.FC<{ shape?: SkeletonShape; label?: string }> = ({ shape = 'list', label = 'Loading' }) => (
  <div className="mx-auto max-w-[1400px] space-y-4" role="status" aria-label={label}>
    <Tiles />
    {shape === 'dashboard' && (
      <div className="grid gap-4 xl:grid-cols-3">
        <CardShell className="xl:col-span-2"><Bone className="mb-6 h-5 w-32" /><Bone className="h-48 w-full rounded-nv-tile" /></CardShell>
        <CardShell><Bone className="mb-6 h-5 w-24" /><Bone className="mx-auto h-40 w-40" /></CardShell>
      </div>
    )}
    {shape === 'list' && (
      <CardShell>
        <Bone className="mb-6 h-11 w-full max-w-sm" />
        <div className="space-y-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Bone className="h-10 w-10" />
              <div className="flex-1 space-y-2"><Bone className="h-4 w-1/3" /><Bone className="h-3 w-1/5" /></div>
              <Bone className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardShell>
    )}
    {shape === 'detail' && (
      <div className="grid gap-4 lg:grid-cols-2">
        <CardShell><Bone className="mb-4 h-8 w-40" /><Bone className="h-32 w-full rounded-nv-tile" /></CardShell>
        <CardShell className="space-y-4">{[0, 1, 2, 3].map(i => <Bone key={i} className="h-4 w-full" />)}</CardShell>
      </div>
    )}
  </div>
);
