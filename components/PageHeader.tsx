import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Currency } from '../types';
import { cn } from '../lib/utils';
import Icon from './ui/Icon';
import { CountUp } from './ui/Money';

const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const;

export type StatTone =
  | 'positive'
  | 'negative'
  | 'attention'
  | 'blue'
  | 'teal'
  | 'rose'
  | 'tomato'
  | 'primary'
  | 'pine'
  | 'amber'
  | 'neutral';

export interface PageStat {
  label: string;
  icon: string;
  value: number;
  format?: 'money' | 'number' | 'percent';
  currency?: Currency;
  /** Text after the figure, such as "of 12" or "3 late". */
  badge?: string;
  badgeTone?: 'pine' | 'butter' | 'tomato';
  /** Color tone for the KPI icon and its circular badge */
  iconTone?: StatTone;
  /** Optional custom class for the icon */
  iconColor?: string;
}

const KPI_ICON_TONES: Record<StatTone, { text: string; bg: string; border: string }> = {
  positive: { text: 'text-money-in', bg: 'bg-money-in-soft/70', border: 'border-money-in/25' },
  negative: { text: 'text-money-out', bg: 'bg-money-out-soft/70', border: 'border-money-out/25' },
  attention: { text: 'text-attention-text', bg: 'bg-amber-soft/70', border: 'border-amber/25' },
  amber: { text: 'text-attention-text', bg: 'bg-amber-soft/70', border: 'border-amber/25' },
  blue: { text: 'text-blue', bg: 'bg-blue-soft/70', border: 'border-blue/25' },
  teal: { text: 'text-teal', bg: 'bg-teal-soft/70', border: 'border-teal/25' },
  rose: { text: 'text-rose', bg: 'bg-rose-soft/70', border: 'border-rose/25' },
  tomato: { text: 'text-tomato', bg: 'bg-tomato-soft/70', border: 'border-tomato/25' },
  primary: { text: 'text-primary', bg: 'bg-primary-soft/70', border: 'border-primary/25' },
  pine: { text: 'text-pine', bg: 'bg-primary-soft/70', border: 'border-pine/25' },
  neutral: { text: 'text-ink', bg: 'bg-[var(--surface)]', border: 'border-[var(--rim)]' },
};

const resolveStatTone = (stat: PageStat, index: number): StatTone => {
  if (stat.iconTone && KPI_ICON_TONES[stat.iconTone]) {
    return stat.iconTone;
  }

  const icon = stat.icon.toLowerCase();
  const label = stat.label.toLowerCase();

  // Negative / Outflow / Overdue / Debt
  if (
    icon === 'arrow_upward' ||
    icon === 'trending_down' ||
    icon === 'warning' ||
    icon === 'error' ||
    label.includes('money out') ||
    label.includes('spent') ||
    label.includes('overdue') ||
    label.includes('going out') ||
    label.includes('still to pay')
  ) {
    return icon === 'warning' || label.includes('overdue') ? 'tomato' : 'negative';
  }

  // Positive / Inflow / Paid / Growth
  if (
    icon === 'arrow_downward' ||
    icon === 'trending_up' ||
    icon === 'check_circle' ||
    icon === 'task_alt' ||
    label.includes('money in') ||
    label.includes('coming in') ||
    label.includes('paid') ||
    label.includes('income')
  ) {
    return 'positive';
  }

  // Savings / Reserves
  if (icon === 'savings' || label.includes('save') || label.includes('saved') || label.includes('left to spend')) {
    return 'teal';
  }

  // Attention / Due soon / Pending
  if (
    icon === 'schedule' ||
    icon === 'alarm' ||
    icon === 'bolt' ||
    label.includes('due') ||
    label.includes('rules on') ||
    label.includes('merchants')
  ) {
    return 'amber';
  }

  // Tasks / Documents / Transactions / Accounts
  if (
    icon === 'receipt' ||
    icon === 'task' ||
    icon === 'account_balance' ||
    icon === 'folder' ||
    icon === 'refresh' ||
    label.includes('transaction') ||
    label.includes('institution')
  ) {
    return 'blue';
  }

  // Wallet / Balance / Portfolios
  if (
    icon === 'account_balance_wallet' ||
    icon === 'nav_investments' ||
    icon === 'balance' ||
    label.includes('balance') ||
    label.includes('net') ||
    label.includes('portfolio')
  ) {
    return 'primary';
  }

  // Payments / Cards / Subscriptions / Goals
  if (
    icon === 'payments' ||
    icon === 'credit_card' ||
    icon === 'flag' ||
    icon === 'pie_chart'
  ) {
    return index % 2 === 0 ? 'rose' : 'teal';
  }

  const cycle: StatTone[] = ['blue', 'teal', 'amber', 'rose', 'primary'];
  return cycle[index % cycle.length];
};

export interface PageHeaderProps {
  /** Older pages still pass these. The new header has no marker, and they go as each page is rebuilt. */
  markerIcon?: string;
  markerLabel?: string;
  markerClassName?: string;
  accentColor?: string;
  title: string;
  subtitle?: string;
  /** Up to three headline figures, shown beside the title in place of the subtitle (D-088). */
  stats?: PageStat[];
  actions?: React.ReactNode;
  className?: string;
}

const BADGE_TONES = {
  pine: 'bg-pine text-on-pine',
  butter: 'bg-amber text-on-amber',
  tomato: 'bg-money-out text-on-danger',
};

/** Each letter rises out of its word, one after the other. */
const AnimatedTitle: React.FC<{ title: string }> = ({ title }) => {
  const isStill = useReducedMotion();
  let index = 0;
  return (
    <h1 aria-label={title} className="text-[clamp(1.75rem,2.6vw,2.375rem)] font-semibold leading-[1.04] tracking-[-.025em] text-ink">
      {isStill ? title : title.split(' ').map((word, wordIndex) => (
        <React.Fragment key={wordIndex}>
          {wordIndex > 0 && ' '}
          <span aria-hidden="true" className="-mb-[.08em] inline-block overflow-hidden pb-[.08em] align-top">
            {[...word].map((letter, letterIndex) => (
              <motion.span
                key={letterIndex}
                className="inline-block"
                initial={{ y: '115%', rotate: 6 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: 0.85, ease: EASE_OUT_QUINT, delay: index++ * 0.022 }}
              >
                {letter}
              </motion.span>
            ))}
          </span>
        </React.Fragment>
      ))}
    </h1>
  );
};

const Rise: React.FC<{ index: number; className?: string; children: React.ReactNode }> = ({ index, className, children }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.55, ease: EASE_OUT_QUART, delay: 0.12 + index * 0.08 }}
  >
    {children}
  </motion.div>
);

/** Title, headline figures and actions in one row. Search and notifications live in the app's top bar. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, stats = [], actions, className }) => {
  const isStill = useReducedMotion();
  const Wrapper = isStill ? 'div' : Rise;
  return (
    <header className={cn('mb-6 flex flex-wrap items-center gap-x-[clamp(28px,4vw,72px)] gap-y-4', className)}>
      <div className="min-w-0 max-md:w-full">
        <AnimatedTitle title={title} />
        {subtitle && stats.length === 0 && <p className="type-body mt-1 max-w-3xl text-muted">{subtitle}</p>}
      </div>
      {stats.length > 0 && (
        <dl className="flex flex-wrap gap-x-[clamp(24px,3.2vw,56px)] gap-y-3.5">
          {stats.map((stat, index) => {
            const toneKey = resolveStatTone(stat, index);
            const tone = KPI_ICON_TONES[toneKey] ?? KPI_ICON_TONES.neutral;
            return (
              <Wrapper key={stat.label} index={index} className="flex items-center gap-3">
                <span className={cn('grid size-[46px] shrink-0 place-items-center rounded-full border transition-colors', tone.border, tone.bg)}>
                  <Icon name={stat.icon} size={20} className={cn(tone.text, stat.iconColor)} />
                </span>
                <div className="flex min-w-0 flex-col-reverse">
                <dt className="max-w-[150px] text-[.78125rem] leading-[1.3] text-muted">{stat.label}</dt>
                <dd className="flex items-center gap-2.5 text-[1.3125rem] font-semibold tracking-[-.01em] text-ink">
                  <CountUp value={stat.value} format={stat.format} currency={stat.currency} delay={0.15 + index * 0.06} />
                  {stat.badge && <span className={cn('type-caption whitespace-nowrap rounded-full px-2 py-0.5', BADGE_TONES[stat.badgeTone ?? 'pine'])}>{stat.badge}</span>}
                </dd>
              </div>
            </Wrapper>
          );
        })}
        </dl>
      )}
      {actions && (
        <Wrapper index={stats.length} className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto md:justify-end">
          {actions}
        </Wrapper>
      )}
    </header>
  );
};

export const HeroHeader = PageHeader;
export default PageHeader;
