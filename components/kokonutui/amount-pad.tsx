/**
 * @author: @dorianbaffier
 * @description: Amount Pad
 * @version: 1.0.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Crystal port (UI_UX_DESIGN_REFERENCE.md D13): a controlled amount field. Kept: the spring digits, commas
 * that slide, faint cents still to come, shrink-to-fit and the refusal shake. Removed: the recipient, presets,
 * balance line and Send button (the form owns saving). `nv-*` tokens and NvIcon instead of zinc and lucide.
 * `keypad` shows the on-screen keys (phones); without it the amount itself takes typing (desktop).
 */

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { NvIcon } from '../new/NvIcon';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MAX_WHOLE_DIGITS = 9;
const DIGIT = /^\d$/;
const KEY_LABELS: Record<string, string> = { back: 'Delete', '.': 'Decimal point' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

export interface AmountPadProps {
  /** The amount as typed, for example "42.5". Empty for none. */
  value: string;
  onChange: (value: string) => void;
  /** Currency sign drawn before the amount. */
  currency: string;
  /** Show the on-screen keypad. */
  keypad?: boolean;
  /** Accessible name of the amount. */
  label?: string;
  /** Colour class for the typed digits. */
  toneClassName?: string;
  className?: string;
  autoFocus?: boolean;
}

/** One typed character, with an id that follows it as commas move around. */
interface Char { id: number; char: string }

interface Glyph { key: string; char: string; kind: 'digit' | 'sep' | 'ghost' }

/** What typing `key` does to the amount: the new characters, or null if it can't take it. */
function typeKey(chars: Char[], key: string, make: (char: string) => Char): Char[] | null {
  const point = chars.findIndex(c => c.char === '.');
  if (key === '.') {
    if (point !== -1) return null;
    return chars.length === 0 ? [make('0'), make('.')] : [...chars, make('.')];
  }
  const centsFull = point !== -1 && chars.length - point > 2;
  const wholeFull = point === -1 && chars.length >= MAX_WHOLE_DIGITS;
  if (centsFull || wholeFull) return null;
  // A lone leading zero is replaced, not followed.
  return chars.length === 1 && chars[0].char === '0' ? [make(key)] : [...chars, make(key)];
}

/** Lays typed characters out as an amount: commas every three whole digits, faint zeros for the cents still to come. */
function layout(chars: Char[]): Glyph[] {
  const point = chars.findIndex(c => c.char === '.');
  const whole = point === -1 ? chars : chars.slice(0, point);
  const glyphs: Glyph[] = [];
  whole.forEach((c, index) => {
    const fromRight = whole.length - index;
    if (index > 0 && fromRight % 3 === 0) glyphs.push({ key: `comma-${c.id}`, char: ',', kind: 'sep' });
    glyphs.push({ key: `d-${c.id}`, char: c.char, kind: 'digit' });
  });
  if (point !== -1) {
    const cents = chars.slice(point + 1);
    glyphs.push({ key: `d-${chars[point].id}`, char: '.', kind: 'sep' });
    for (const c of cents) glyphs.push({ key: `d-${c.id}`, char: c.char, kind: 'digit' });
    for (let i = cents.length; i < 2; i++) glyphs.push({ key: `ghost-${i}`, char: '0', kind: 'ghost' });
  }
  return glyphs;
}

const asString = (chars: Char[]) => chars.map(c => c.char).join('');

export function AmountPad({ value, onChange, currency, keypad, label = 'Amount', toneClassName = 'text-nv-ink', className, autoFocus }: AmountPadProps) {
  const nextId = useRef(1);
  const make = (char: string): Char => ({ id: nextId.current++, char });
  const [chars, setCharsState] = useState<Char[]>(() => [...value].map(make));
  // Crystal patch: keys can arrive faster than React re-renders (fast typing, paste-like bursts), so each
  // press reads and writes the latest characters through a ref instead of the rendered state.
  const charsRef = useRef(chars);
  const setChars = (next: Char[]) => { charsRef.current = next; setCharsState(next); };
  const reduceMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const fit = useMotionValue(1);
  const shakeX = useMotionValue(0);
  const empty = chars.length === 0;

  // Follow the value when it changes from outside (reset after save, editing another transaction).
  useEffect(() => {
    if (value !== asString(charsRef.current)) setChars([...value].map(make));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => { if (autoFocus && !keypad) fieldRef.current?.focus(); }, [autoFocus, keypad]);

  // The amount shrinks to stay on one line as it grows, and grows back as digits are deleted.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const amount = amountRef.current;
    if (!(frame && amount)) return;
    const measure = () => {
      const target = Math.min(1, frame.clientWidth / amount.scrollWidth);
      animate(fit, target, reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(amount);
    return () => observer.disconnect();
  }, [fit, reduceMotion]);

  const refuse = () => {
    if (!reduceMotion) animate(shakeX, [0, -10, 9, -6, 4, 0], { duration: 0.36, ease: 'easeOut' });
  };

  const press = (key: string) => {
    const current = charsRef.current;
    const next = key === 'back' ? current.slice(0, -1) : typeKey(current, key, make);
    if (!next) { refuse(); return; }
    setChars(next);
    onChange(asString(next));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    let key: string | null = null;
    if (DIGIT.test(event.key) || event.key === '.') key = event.key;
    else if (event.key === ',') key = '.';
    else if (event.key === 'Backspace') key = 'back';
    if (key) { event.preventDefault(); press(key); }
  };

  const glyphs = layout(chars);
  const digitIn = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.8 };
  const slide = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 500, damping: 40 };

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div
        ref={fieldRef}
        role="textbox"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="rounded-nv-tile outline-none focus-visible:ring-2 focus-visible:ring-nv-violet"
      >
        <div className="flex h-20 items-center justify-center" ref={frameRef}>
          <output aria-live="polite" className="sr-only">{`${currency}${value || '0'}`}</output>
          <motion.div
            aria-hidden="true"
            className={cn('nv-tabular flex origin-center items-baseline whitespace-nowrap text-[56px] font-semibold leading-none tracking-tight', toneClassName)}
            ref={amountRef}
            style={{ scale: fit, x: shakeX }}
          >
            <span className={cn('mr-0.5 transition-colors duration-200', empty ? 'text-nv-line' : 'text-nv-violet-text')}>{currency}</span>
            <AnimatePresence initial={false} mode="popLayout">
              {empty && (
                <motion.span animate={{ opacity: 1 }} className="text-nv-line" exit={{ opacity: 0, transition: { duration: 0.08 } }} initial={{ opacity: 0 }} key="placeholder" transition={{ duration: 0.15 }}>
                  0
                </motion.span>
              )}
              {glyphs.map(glyph => (
                <motion.span
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  className={cn('inline-block', glyph.kind === 'ghost' && 'text-nv-line', glyph.kind === 'sep' && 'text-nv-faint')}
                  exit={{ opacity: 0, y: 18, filter: 'blur(2px)', transition: { duration: 0.14, ease: EASE_OUT } }}
                  initial={{ opacity: 0, y: -22, filter: 'blur(2px)' }}
                  key={glyph.key}
                  layout="position"
                  transition={{ default: digitIn, layout: slide, filter: { duration: 0.16 } }}
                >
                  {glyph.char}
                </motion.span>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
        {!keypad && <p className="pb-1 text-center text-xs text-nv-muted">{empty ? 'Type an amount' : ' '}</p>}
      </div>

      {keypad && (
        <div className="mt-3 grid grid-cols-3 gap-1">
          {KEYS.map(key => (
            <button
              aria-label={KEY_LABELS[key] ?? key}
              className="flex h-14 items-center justify-center rounded-nv-tile text-2xl font-medium text-nv-ink outline-none transition-colors duration-100 hover:bg-nv-inset focus-visible:ring-2 focus-visible:ring-nv-violet active:bg-nv-inset nv-tabular"
              key={key}
              onClick={() => press(key)}
              type="button"
            >
              {key === 'back' ? <NvIcon name="backspace" size={24} className="text-nv-muted" /> : key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
