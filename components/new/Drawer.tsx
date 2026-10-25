import React, { useEffect, useState } from 'react';
import { Drawer as Vaul } from 'vaul';
import { cn } from '../../lib/utils';
import { IconButton } from './ui';

/** True when the viewport matches `query`. Updates on resize. */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
};

/**
 * While a phone bottom sheet is open, `<html data-nv-sheet>` is set so toasts move to the top and never cover
 * the sheet's actions (D4).
 */
export const useSheetFlag = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const count = Number(root.dataset.nvSheet || 0) + 1;
    root.dataset.nvSheet = String(count);
    return () => {
      const left = Number(root.dataset.nvSheet || 1) - 1;
      if (left > 0) root.dataset.nvSheet = String(left);
      else delete root.dataset.nvSheet;
    };
  }, [active]);
};

/** The light blur veil behind every New sheet and dialog (D7): the page blurs, it is not darkened. */
export const SCRIM_CLASS = 'crystal-new fixed inset-0 z-modal bg-nv-canvas/50 backdrop-blur-xl';

/**
 * The one sheet for the New pages (§3.1, decision Q12): a Vaul bottom sheet with a drag handle on phones and a
 * right-hand drawer from 768px. Sticky header and footer (D7: kept for long forms), light blur scrim. No nested
 * elevated cards inside: use `bg-nv-inset` panels. Vaul handles focus trapping, Escape and focus return.
 */
export const Drawer: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Desktop width in px. */
  width?: number;
  /** Desktop edge. The navigation drawer opens from the left (R4). */
  side?: 'right' | 'left';
}> = ({ open, onOpenChange, title, description, footer, children, width = 480, side = 'right' }) => {
  const desktop = useMediaQuery('(min-width: 768px)');
  useSheetFlag(open && !desktop);
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange} direction={desktop ? side : 'bottom'}>
      <Vaul.Portal>
        <Vaul.Overlay className={SCRIM_CLASS} />
        <Vaul.Content
          className={cn(
            'crystal-new fixed z-modal flex flex-col bg-nv-surface shadow-nv-float outline-none',
            desktop
              ? cn('bottom-3 top-3 rounded-nv-card', side === 'left' ? 'left-3' : 'right-3')
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px]',
          )}
          style={desktop ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}
        >
          {!desktop && <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-nv-line" aria-hidden />}
          <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-5">
            <div className="min-w-0">
              <Vaul.Title className="text-xl font-semibold text-nv-ink">{title}</Vaul.Title>
              {description
                ? <Vaul.Description className="mt-1 text-sm text-nv-muted">{description}</Vaul.Description>
                : <Vaul.Description className="sr-only">{title}</Vaul.Description>}
            </div>
            <IconButton icon="close" label="Close" size={40} onClick={() => onOpenChange(false)} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <footer className="nv-safe-bottom shrink-0 border-t border-nv-line px-6 pt-4">{footer}</footer>}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
};
