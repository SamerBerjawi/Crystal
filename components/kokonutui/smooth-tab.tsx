/**
 * @author: @dorianbaffier
 * @description: Smooth Tab (Swipe Tabs)
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Crystal port (UI_UX_DESIGN_REFERENCE.md §3.2): the tab list only (the page owns the panels), `nv-*` tokens, NvIcon
 * instead of lucide-react, generic over the tab id. The indicator is a clip-path over a second copy of the labels in
 * the active colour, so every label is exactly right at every point of the slide. The slide spring is unchanged.
 */

import { animate, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';
import { NvIcon, type NvIconName } from '../new/NvIcon';

export interface SmoothTabItem<T extends string> {
  id: T;
  label: string;
  icon?: NvIconName;
  /** Class for the icon while the tab is not selected. */
  iconClass?: string;
}

interface SmoothTabProps<T extends string> {
  items: SmoothTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  size?: 'sm' | 'md';
  /** The tabs share the full width equally. */
  fill?: boolean;
  className?: string;
}

interface TabRect { left: number; width: number; top: number; height: number }

const SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** The indicator rectangle at a fractional tab position. */
function indicatorRect(rects: TabRect[], progress: number): TabRect | null {
  const last = rects.length - 1;
  if (last < 0) return null;
  const p = clamp(progress, 0, last);
  const i = Math.min(Math.floor(p), Math.max(last - 1, 0));
  const a = rects[i];
  const b = rects[Math.min(i + 1, last)];
  const t = p - i;
  return { left: lerp(a.left, b.left, t), width: lerp(a.width, b.width, t), top: a.top, height: a.height };
}

export function SmoothTab<T extends string>({ items, value, onChange, label, size = 'md', fill, className }: SmoothTabProps<T>) {
  const count = items.length;
  const selected = Math.max(items.findIndex(item => item.id === value), 0);
  const progress = useMotionValue(selected);
  const tablistRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rects = useRef<TabRect[]>([]);
  const box = useRef({ width: 0, height: 0 });
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const reducedMotion = useRef(false);
  const first = useRef(true);

  const paint = useCallback((p: number) => {
    const overlay = overlayRef.current;
    const r = indicatorRect(rects.current, p);
    if (!overlay || !r) return;
    const right = box.current.width - r.left - r.width;
    const bottom = box.current.height - r.top - r.height;
    overlay.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${r.height / 2}px)`;
  }, []);

  // Measure the tabs before paint, and again on resize and font load.
  useLayoutEffect(() => {
    const tablist = tablistRef.current;
    if (!tablist) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const outer = tablist.getBoundingClientRect();
      const ratio = outer.width / (tablist.offsetWidth || 1);
      const scale = Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
      box.current = { width: outer.width / scale, height: outer.height / scale };
      rects.current = tabRefs.current.slice(0, count).map(tab => {
        const r = tab?.getBoundingClientRect();
        return r
          ? { left: (r.left - outer.left) / scale, width: r.width / scale, top: (r.top - outer.top) / scale, height: r.height / scale }
          : { left: 0, width: 0, top: 0, height: 0 };
      });
      paint(progress.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tablist);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => { alive = false; observer.disconnect(); };
  }, [count, items, paint, progress]);

  useEffect(() => {
    const unsubscribe = progress.on('change', paint);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reducedMotion.current = query.matches; };
    sync();
    query.addEventListener('change', sync);
    return () => { unsubscribe(); query.removeEventListener('change', sync); anim.current?.stop(); };
  }, [paint, progress]);

  // The selection moves (a click, a key, or the page changing it): slide there.
  useEffect(() => {
    if (first.current) { first.current = false; progress.jump(selected); return; }
    anim.current?.stop();
    anim.current = reducedMotion.current
      ? animate(progress, selected, { duration: 0.15, ease: EASE_OUT })
      : animate(progress, selected, SPRING);
  }, [selected, progress]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = { ArrowRight: (i + 1) % count, ArrowLeft: (i - 1 + count) % count, Home: 0, End: count - 1 };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    onChange(items[next].id);
  };

  // 36px tabs in a 44px track; each tab's hit area reaches the track edges (D14: 44px targets).
  const pad = cn(size === 'md' ? 'h-9 px-4 text-sm' : 'h-9 px-3 text-[13px]', fill ? 'flex-1' : 'shrink-0');
  const hit = "after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']";
  return (
    <div role="tablist" aria-label={label} ref={tablistRef} className={cn(fill ? 'relative flex' : 'relative inline-flex', 'max-w-full overflow-x-auto rounded-full bg-nv-inset p-1 [scrollbar-width:none]', className)}>
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={el => { tabRefs.current[i] = el; }}
          role="tab"
          type="button"
          aria-selected={i === selected}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={e => onKeyDown(e, i)}
          className={cn(
            'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none text-nv-muted outline-none transition-colors duration-150 hover:text-nv-ink focus-visible:ring-2 focus-visible:ring-nv-violet',
            pad,
            hit,
          )}
        >
          {item.icon && <NvIcon name={item.icon} size={16} className={item.iconClass} />}
          {item.label}
        </button>
      ))}
      {/* The same labels in the active colour, clipped to the indicator. */}
      <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 flex bg-nv-ink p-1" style={{ clipPath: 'inset(0 100% 0 0)' }}>
        {items.map(item => (
          <span key={item.id} className={cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium leading-none text-nv-on-ink', pad)}>
            {item.icon && <NvIcon name={item.icon} size={16} />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
