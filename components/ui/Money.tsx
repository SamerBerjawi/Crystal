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

export interface AmountParts {
  sign: string;
  symbol: string;
  integer: string;
  fraction: string;
  suffix: string;
}

export function splitAmount(text: string): AmountParts {
  // BTC or suffix currency (e.g. "0.50 BTC" or "− 1.2345 BTC")
  const btcMatch = text.match(/^([+\-−]?\s*)([\d,]+)(\.\d+)?(\s*BTC.*)?$/);
  if (btcMatch && btcMatch[4]) {
    return {
      sign: btcMatch[1] || '',
      symbol: '',
      integer: btcMatch[2] || '',
      fraction: btcMatch[3] || '',
      suffix: btcMatch[4] || '',
    };
  }

  // Prefix currency (e.g. "€276,043.15", "+ €1,200.50", "− €54.20", "lei 1,500.00", "$50.00", "€12.5k")
  const match = text.match(/^([+\-−]?\s*)([^\d\s]+(?:\s+)?)([\d,]+)(\.\d+)?(.*)$/);
  if (match) {
    return {
      sign: match[1] || '',
      symbol: match[2] || '',
      integer: match[3] || '',
      fraction: match[4] || '',
      suffix: match[5] || '',
    };
  }

  return { sign: '', symbol: '', integer: text, fraction: '', suffix: '' };
}

/** Formats currency symbol in accent color (`text-primary`), digits in inherited color, and decimals in grey (`text-muted`). */
export const FormattedAmount: React.FC<{
  text: string;
  className?: string;
  symbolClassName?: string;
  fractionClassName?: string;
  integerClassName ?: string;
}> = ({ text, className, symbolClassName, fractionClassName, integerClassName }) => {
  const { sign, symbol, integer, fraction, suffix } = splitAmount(text);
  const isBtcSuffix = suffix.trim() === 'BTC';

  const content = (
    <>
      {sign && <span className={cn('amount-symbol text-primary font-semibold', symbolClassName)}>{sign}</span>}
      {symbol && <span className={cn('amount-symbol text-primary font-semibold', symbolClassName)}>{symbol}</span>}
      <span className={cn('amount-integer text-ink', integerClassName)}>{integer}</span>
      {fraction && <span className={cn('amount-fraction text-muted', fractionClassName)}>{fraction}</span>}
      {suffix && (
        <span
          className={cn(
            'amount-suffix',
            isBtcSuffix ? cn('amount-symbol text-primary font-semibold', symbolClassName) : cn('amount-fraction text-muted', fractionClassName)
          )}
        >
          {suffix}
        </span>
      )}
    </>
  );

  return className ? <span className={className}>{content}</span> : content;
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
      <span className={cn('tabular-nums', tone === 'loss' && value < 0 && 'text-money-out', className)}>
        {countUp ? (
          <>
            <span aria-hidden="true"><FormattedAmount text={text(shown)} /></span>
            <span className="sr-only">{text(value)}</span>
          </>
        ) : <FormattedAmount text={text(value)} />}
      </span>
      );
};

      /** A headline figure that counts up. Money follows privacy mode, and screen readers get the final value. */
      export const CountUp: React.FC<{ value: number; format?: 'money' | 'number' | 'percent'; currency?: Currency; delay?: number }> = ({value, format = 'number', currency = getMainCurrency(), delay}) => {
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
        <span aria-hidden="true">{format === 'money' ? <FormattedAmount text={text(shown)} /> : text(shown)}</span>
        <span className="sr-only">{text(value)}</span>
      </span>
      );
};

      /** Icon, sign and words, so a change never relies on colour: "+ €1,206 this month". */
      export const Change: React.FC<{ value: number; currency: Currency; period: string; className?: string }> = ({value, currency, period, className}) => {
  const isUp = value >= 0;
      return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <Icon name={isUp ? 'arrow_upward' : 'arrow_downward'} size={16} />
        <span><Amount value={isUp ? Math.abs(value) : value} currency={currency} className="font-bold" /> {period}</span>
      </span>
      );
};
