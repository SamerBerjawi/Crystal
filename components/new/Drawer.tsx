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

const keepForLayers = (event: { target: EventTarget | null; preventDefault: () => void; detail?: { originalEvent?: Event } }) => {
  const target = (event.detail?.originalEvent?.target ?? event.target) as HTMLElement | null;
  if (target?.closest?.('.z-popover')) event.preventDefault();
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
  /** A full-bleed top section (a map, a banner) that replaces the title bar. It scrolls with the content; the close button floats over it and the title stays for screen readers. */
  hero?: React.ReactNode;
}> = ({ open, onOpenChange, title, description, footer, children, width = 480, side = 'right', hero }) => {
  const desktop = useMediaQuery('(min-width: 768px)');
  useSheetFlag(open && !desktop);
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange} direction={desktop ? side : 'bottom'}>
      <Vaul.Portal>
        <Vaul.Overlay className={SCRIM_CLASS} />
        <Vaul.Content
          // Popovers and menus open in their own layer outside the sheet; using one is not a click outside it.
          onPointerDownOutside={keepForLayers}
          onInteractOutside={keepForLayers}
          className={cn(
            'crystal-new fixed z-modal flex flex-col overflow-hidden bg-nv-surface shadow-nv-float outline-none',
            desktop
              ? cn('bottom-3 top-3 rounded-nv-card', side === 'left' ? 'left-3' : 'right-3')
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px]',
          )}
          style={desktop ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}
        >
          {!desktop && <div className={cn('mx-auto h-1.5 w-10 shrink-0 rounded-full bg-nv-line', hero ? 'absolute left-1/2 top-3 z-dropdown -translate-x-1/2 bg-nv-ink/30' : 'mt-3')} aria-hidden />}
          {hero ? (
            <>
              <Vaul.Title className="sr-only">{title}</Vaul.Title>
              <Vaul.Description className="sr-only">{description ?? title}</Vaul.Description>
              <div className="absolute right-4 top-4 z-dropdown"><IconButton icon="close" label="Close" size={40} tone="chip" className="bg-nv-surface/80 backdrop-blur-md" onClick={() => onOpenChange(false)} /></div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {hero}
                <div className="px-6 pb-6">{children}</div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          {footer && <footer className="nv-safe-bottom shrink-0 border-t border-nv-line px-6 pt-4">{footer}</footer>}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
};
