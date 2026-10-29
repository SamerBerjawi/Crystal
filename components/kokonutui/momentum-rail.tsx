/**
 * @author: @dorianbaffier
 * @description: Momentum Rail (Horizontal Snap Carousel with Keyboard & Button Navigation)
 * @version: 1.0.0
 * @date: 2026-10-28
 * @license: MIT
 *
 * Crystal port (UI_UX_DESIGN_REFERENCE.md §4.3, D13):
 * - Horizontal snap-scrolling card rail for the Card Wallet on `/accounts-new`.
 * - Strictly uses `nv-*` tokens and `NvIcon`.
 * - Tracks scroll progress to enable/disable Previous/Next buttons and supports Left/Right arrow keys.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from '../new/ui';
import { NvIcon, type NvIconName } from '../new/NvIcon';
import { IconChip } from '../new/tile';

export interface MomentumRailProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: NvIconName;
  action?: React.ReactNode;
  children: React.ReactNode;
  itemWidthClassName?: string;
  className?: string;
}

export const MomentumRail: React.FC<MomentumRailProps> = ({
  title,
  subtitle,
  icon,
  action,
  children,
  itemWidthClassName = 'w-[310px] sm:w-[340px]',
  className,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, children]);

  const scrollByStep = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.75));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollByStep(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollByStep(1);
      }
    },
    [scrollByStep]
  );

  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className={cn('rounded-nv-card bg-nv-tile p-5 sm:p-6', className)}>
      {(title || icon || action || canPrev || canNext) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconChip icon={icon} />}
            <div className="min-w-0">
              {title && <h2 className="truncate text-lg font-medium text-nv-ink">{title}</h2>}
              {subtitle && <p className="truncate text-[13px] text-nv-muted">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {(canPrev || canNext) && (
              <div className="flex items-center gap-1.5">
                <IconButton
                  icon="arrowLeft"
                  label="Scroll cards left"
                  size={44}
                  tone="chip"
                  disabled={!canPrev}
                  onClick={() => scrollByStep(-1)}
                  className="disabled:opacity-40"
                />
                <IconButton
                  icon="arrowRight"
                  label="Scroll cards right"
                  size={44}
                  tone="chip"
                  disabled={!canNext}
                  onClick={() => scrollByStep(1)}
                  className="disabled:opacity-40"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollerRef}
        role="region"
        aria-label={typeof title === 'string' ? title : 'Card wallet rail'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="nv-scroll -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-nv-violet"
      >
        {items.map((child, idx) => (
          <div key={idx} className={cn(' shrink-0 snap-start', itemWidthClassName)}>
            {child}
          </div>
        ))}
      </div>
    </section>
  );
};

export default MomentumRail;
