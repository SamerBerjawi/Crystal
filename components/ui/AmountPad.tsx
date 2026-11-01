import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, animate } from 'motion/react';
import { cn } from '../../lib/utils';
import { currencySign } from '../../utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MAX_WHOLE_DIGITS = 9;

export interface AmountPadProps {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  autoFocus?: boolean;
  className?: string;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  label?: string;
  alwaysShowDecimals?: boolean;
}

interface Char { id: number; char: string }
interface Glyph { key: string; char: string; kind: 'digit' | 'sep' | 'decimal' | 'ghost' }

function layout(chars: Char[], alwaysShowDecimals = true): Glyph[] {
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
    for (const c of cents) glyphs.push({ key: `d-${c.id}`, char: c.char, kind: 'decimal' });
    for (let i = cents.length; i < 2; i++) glyphs.push({ key: `ghost-${i}`, char: '0', kind: 'ghost' });
  } else if (alwaysShowDecimals && chars.length > 0) {
    glyphs.push({ key: 'ghost-dot', char: '.', kind: 'sep' });
    glyphs.push({ key: 'ghost-0', char: '0', kind: 'ghost' });
    glyphs.push({ key: 'ghost-1', char: '0', kind: 'ghost' });
  }
  return glyphs;
}

const asString = (chars: Char[]) => chars.map(c => c.char).join('');

export const AmountPad: React.FC<AmountPadProps> = ({
  value,
  onChange,
  currency,
  autoFocus,
  className,
  onBlur,
  onKeyDown,
  label = 'Amount',
  alwaysShowDecimals = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const make = (char: string): Char => ({ id: nextId.current++, char });

  const [chars, setCharsState] = useState<Char[]>(() => [...value].map(make));
  const charsRef = useRef(chars);
  const setChars = (next: Char[]) => { charsRef.current = next; setCharsState(next); };

  const reduceMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const fit = useMotionValue(1);

  // Sync external value changes into chars with ID preservation for smooth entry animations
  useEffect(() => {
    if (value !== asString(charsRef.current)) {
      const prev = charsRef.current;
      const next: Char[] = [];
      for (let i = 0; i < value.length; i++) {
        if (i < prev.length && prev[i].char === value[i]) {
          next.push(prev[i]);
        } else {
          next.push(make(value[i]));
        }
      }
      setChars(next);
    }
  }, [value]);

  // Shrink-to-fit if amount gets very long
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const amount = amountRef.current;
    if (!(frame && amount)) return;
    const measure = () => {
      const available = frame.clientWidth;
      const needed = amount.scrollWidth;
      const target = needed > available && available > 0 ? Math.min(1, available / needed) : 1;
      animate(fit, target, reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(amount);
    return () => observer.disconnect();
  }, [fit, reduceMotion, chars]);

  const glyphs = layout(chars, alwaysShowDecimals);
  const empty = chars.length === 0;

  const digitIn = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.8 };
  const slide = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 500, damping: 40 };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-primary/30 dark:border-primary/40 bg-inset p-4 transition-colors focus-within:border-primary cursor-text min-h-[96px]',
        className
      )}
    >
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={e => {
          const val = e.target.value.replace(',', '.');
          if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
            const point = val.indexOf('.');
            const whole = point === -1 ? val : val.slice(0, point);
            if (whole.length <= MAX_WHOLE_DIGITS) {
              onChange(val);
            }
          }
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-label={label}
        className="absolute inset-0 z-10 h-full w-full opacity-0 cursor-text"
      />

      <div ref={frameRef} className="flex w-full items-center justify-center overflow-hidden py-1">
        <motion.div
          ref={amountRef}
          style={{ scale: fit }}
          className="flex origin-center items-baseline whitespace-nowrap text-4xl sm:text-5xl font-semibold tracking-tight text-ink tabular-nums select-none pointer-events-none"
        >
          <span className="mr-1.5 text-primary font-semibold select-none">{currencySign(currency)}</span>

          <AnimatePresence initial={false} mode="popLayout">
            {empty ? (
              <span className="inline-flex items-baseline">
                <span className="text-muted/40 font-semibold">0</span>
                <span className="text-muted/40 font-medium">.00</span>
              </span>
            ) : (
              glyphs.map(glyph => (
                <motion.span
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  className={cn(
                    'inline-block',
                    (glyph.kind === 'sep' || glyph.kind === 'decimal') && 'text-muted font-medium',
                    glyph.kind === 'ghost' && 'text-muted/40 font-medium',
                  )}
                  exit={{ opacity: 0, y: 18, filter: 'blur(2px)', transition: { duration: 0.14, ease: EASE_OUT } }}
                  initial={{ opacity: 0, y: -22, filter: 'blur(2px)' }}
                  key={glyph.key}
                  layout="position"
                  transition={{ default: digitIn, layout: slide, filter: { duration: 0.16 } }}
                >
                  {glyph.char}
                </motion.span>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

