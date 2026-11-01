import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import type { Currency } from '../../types';
import { formatCurrency, getMainCurrency } from '../../utils';
import Icon from './Icon';
import { cn } from '../../lib/utils';

export const PrivacyContext = createContext(false);

const seenThisSession = new Set<string>();
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True the first time a page opens in a session. Staggers play once (D-062). Figures count up on every visit (D-088). */
export const useFirstVisit = (key: string) => {
  const [isFirst] = useState(() => !seenThisSession.has(key) && !prefersReducedMotion());
  useEffect(() => { seenThisSession.add(key); }, [key]);
  return isFirst;
};

const MINUS = '−';
const COUNT_ENTER_SECONDS = 1.4;
const COUNT_CHANGE_SECONDS = 0.9;
const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const;

/** Counts up from zero on arrival, then moves to each new value. */
const useCountUp = (value: number, isActive: boolean, delay = 0) => {
  const shouldRun = isActive && !prefersReducedMotion();
  const [shown, setShown] = useState(shouldRun ? 0 : value);
  const current = useRef(shouldRun ? 0 : value);
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!shouldRun) {
      current.current = value;
      setShown(value);
      return;
    }
    const isEntering = !hasEntered.current;
    hasEntered.current = true;
    const controls = animate(current.current, value, {
      duration: isEntering ? COUNT_ENTER_SECONDS : COUNT_CHANGE_SECONDS,
      delay: isEntering ? delay : 0,
      ease: EASE_OUT_QUART,
      onUpdate: latest => {
        current.current = latest;
        setShown(latest);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, shouldRun, delay]);

  return shown;
};

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

/** A headline figure that counts up. Money follows privacy mode, and screen readers get the final value. */
export const CountUp: React.FC<{ value: number; format?: 'money' | 'number' | 'percent'; currency?: Currency; delay?: number }> = ({ value, format = 'number', currency = getMainCurrency(), delay }) => {
  const isPrivate = useContext(PrivacyContext);
  const hidden = isPrivate && format === 'money';
  const shown = useCountUp(value, !hidden, delay);

  if (hidden) return <span role="img" aria-label="Hidden" className="tabular-nums">•••</span>;

  const text = (n: number) => {
    if (format === 'money') return `${n < 0 ? `${MINUS} ` : ''}${formatCurrency(Math.abs(n), currency)}`;
    if (format === 'percent') return `${Math.round(n)}%`;
    return Math.round(n).toLocaleString();
  };

  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{text(shown)}</span>
      <span className="sr-only">{text(value)}</span>
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
