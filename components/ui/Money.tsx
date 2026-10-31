import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Currency } from '../../types';
import { formatCurrency } from '../../utils';
import Icon from './Icon';
import { cn } from '../../lib/utils';

export const PrivacyContext = createContext(false);

const seenThisSession = new Set<string>();
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True the first time a page opens in a session. Count-ups and staggers play once (D-062). */
export const useFirstVisit = (key: string) => {
  const [isFirst] = useState(() => !seenThisSession.has(key) && !prefersReducedMotion());
  useEffect(() => { seenThisSession.add(key); }, [key]);
  return isFirst;
};

const COUNT_MS = 700;
const COUNT_FROM = 0.9;

/** Eases up from 90% of the value. Later changes jump straight to the new value. */
const useCountUp = (value: number, isActive: boolean) => {
  const [shown, setShown] = useState(isActive ? value * COUNT_FROM : value);
  const started = useRef(false);

  useEffect(() => {
    if (!isActive || started.current) {
      setShown(value);
      return;
    }
    started.current = true;
    const begin = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - begin) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * (COUNT_FROM + (1 - COUNT_FROM) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, isActive]);

  return shown;
};

const MINUS = '−';

export interface AmountProps {
  value: number;
  currency: Currency;
  /** `flow` shows direction: income green with a plus, spending plain with a minus (D-063). `loss` shows negatives in red. */
  tone?: 'plain' | 'flow' | 'loss';
  countUp?: boolean;
  className?: string;
}

/** Every figure in the app: tabular, signed, and hidden in privacy mode, from screen readers too. */
export const Amount: React.FC<AmountProps> = ({ value, currency, tone = 'plain', countUp = false, className }) => {
  const isPrivate = useContext(PrivacyContext);
  const shown = useCountUp(value, countUp && !isPrivate);

  if (isPrivate) return <span role="img" aria-label="Hidden" className={cn('tabular-nums', className)}>•••</span>;

  const sign = value < 0 ? `${MINUS} ` : tone === 'flow' && value > 0 ? '+ ' : '';
  const text = (n: number) => `${sign}${formatCurrency(Math.abs(n), currency)}`;

  return (
    <span className={cn('tabular-nums', tone === 'flow' && value > 0 && 'text-money-in', tone === 'loss' && value < 0 && 'text-money-out', className)}>
      {countUp ? (
        <>
          <span aria-hidden="true">{text(shown)}</span>
          <span className="sr-only">{text(value)}</span>
        </>
      ) : text(value)}
    </span>
  );
};

/** Icon, sign and words, so a change never relies on colour: "+ €1,206 this month". */
export const Change: React.FC<{ value: number; currency: Currency; period: string; className?: string }> = ({ value, currency, period, className }) => {
  const isUp = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon name={isUp ? 'arrow_upward' : 'arrow_downward'} size={16} />
      <span><Amount value={isUp ? Math.abs(value) : value} currency={currency} className="font-bold" /> {period}</span>
    </span>
  );
};
