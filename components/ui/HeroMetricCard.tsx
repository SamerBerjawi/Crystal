import React from 'react';
import Icon from './Icon';
import { cn } from '../../lib/utils';

// Maps a semantic color name to Tailwind classes for icon container and text
const COLOR_MAP: Record<string, { container: string; icon: string; border: string; glow: string }> = {
  primary:  { container: 'bg-primary-500/10 dark:bg-primary-500/15 border-primary-500/20 dark:border-primary-500/30', icon: 'text-primary-500 dark:text-primary-400', border: 'border-primary-500/30 dark:border-primary-500/40', glow: 'shadow-[0_0_20px_rgba(250,154,29,0.15)]' },
  emerald:  { container: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 dark:border-emerald-500/30', icon: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/30 dark:border-emerald-500/40', glow: 'shadow-[0_0_20px_rgba(52,199,89,0.15)]' },
  rose:     { container: 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20 dark:border-rose-500/30', icon: 'text-rose-500 dark:text-rose-400', border: 'border-rose-500/30 dark:border-rose-500/40', glow: 'shadow-[0_0_20px_rgba(255,59,48,0.15)]' },
  amber:    { container: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 dark:border-amber-500/30', icon: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/30 dark:border-amber-500/40', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
  blue:     { container: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20 dark:border-blue-500/30', icon: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500/30 dark:border-blue-500/40', glow: 'shadow-[0_0_20px_rgba(0,122,255,0.15)]' },
  indigo:   { container: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 dark:border-indigo-500/30', icon: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-500/30 dark:border-indigo-500/40', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]' },
  purple:   { container: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20 dark:border-purple-500/30', icon: 'text-purple-500 dark:text-purple-400', border: 'border-purple-500/30 dark:border-purple-500/40', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
  cyan:     { container: 'bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/20 dark:border-cyan-500/30', icon: 'text-cyan-500 dark:text-cyan-400', border: 'border-cyan-500/30 dark:border-cyan-500/40', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]' },
  teal:     { container: 'bg-teal-500/10 dark:bg-teal-500/15 border-teal-500/20 dark:border-teal-500/30', icon: 'text-teal-500 dark:text-teal-400', border: 'border-teal-500/30 dark:border-teal-500/40', glow: 'shadow-[0_0_20px_rgba(20,184,166,0.15)]' },
  orange:   { container: 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/20 dark:border-orange-500/30', icon: 'text-orange-500 dark:text-orange-400', border: 'border-orange-500/30 dark:border-orange-500/40', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]' },
  pink:     { container: 'bg-pink-500/10 dark:bg-pink-500/15 border-pink-500/20 dark:border-pink-500/30', icon: 'text-pink-500 dark:text-pink-400', border: 'border-pink-500/30 dark:border-pink-500/40', glow: 'shadow-[0_0_20px_rgba(236,72,153,0.15)]' },
  slate:    { container: 'bg-slate-500/10 dark:bg-slate-500/15 border-slate-500/20 dark:border-slate-500/30', icon: 'text-slate-500 dark:text-slate-400', border: 'border-slate-500/30 dark:border-slate-500/40', glow: 'shadow-[0_0_20px_rgba(100,116,139,0.15)]' },
  neutral:  { container: 'bg-neutral-500/10 dark:bg-white/5 border-neutral-500/20 dark:border-white/10', icon: 'text-neutral-600 dark:text-neutral-300', border: 'border-slate-200/80 dark:border-white/10', glow: '' },
};

// Icon container size variants
const ICON_SIZE_MAP = {
  sm: { container: 'w-8 h-8', icon: 'text-base' },
  md: { container: 'w-10 h-10', icon: 'text-xl' },
  lg: { container: 'w-12 h-12', icon: 'text-2xl' },
};

export interface HeroMetricCardProps {
  /** Short all-caps label above the value */
  label: string;
  /** Primary metric value — string or number */
  value: string | number;
  /** Icon name passed to the Icon component */
  icon: string;
  /**
   * Semantic accent color for the icon container and icon.
   * Accepts a color key from the design system.
   * @default "primary"
   */
  iconColor?: keyof typeof COLOR_MAP;
  /**
   * Visual hierarchy tier:
   * 'primary': Hero emphasis with larger value font, accent border & ambient glow.
   * 'secondary': Standard neutral glass card (default).
   */
  variant?: 'primary' | 'secondary';
  /** Optional description / secondary text below the value */
  subtext?: string;
  /**
   * Trend direction — shows a semantic delta row at the bottom.
   * Requires `trendValue` to be useful.
   */
  trend?: 'up' | 'down' | 'neutral';
  /** Human-readable delta string, e.g. "+12.4%" or "vs last month" */
  trendValue?: string;
  /**
   * Icon container size.
   * sm=w-8, md=w-10 (default), lg=w-12
   */
  iconSize?: keyof typeof ICON_SIZE_MAP;
  /** Applies privacy-blur CSS class to the value — used on Dashboard */
  privacyBlur?: boolean;
  /** Optional badge text displayed next to the label */
  badgeText?: string;
  badgeVariant?: 'optimal' | 'elevated' | 'low' | 'normal' | 'neutral';
  onClick?: () => void;
  className?: string;
}

/**
 * HeroMetricCard — the single, canonical hero stat card for Crystal.
 *
 * Supports 'primary' (hero emphasis with larger value + accent glow) and
 * 'secondary' (clean neutral glass) to enforce a unified visual hierarchy.
 *
 * Conforms to DESIGN.md tokens: rounded-2xl shell, rounded-xl icon container,
 * text-2xl to text-4xl mono value, 44px+ touch target, light + dark mode.
 */
const HeroMetricCard: React.FC<HeroMetricCardProps> = ({
  label,
  value,
  icon,
  iconColor = 'primary',
  variant = 'secondary',
  subtext,
  trend,
  trendValue,
  iconSize = 'md',
  privacyBlur = false,
  badgeText,
  badgeVariant = 'normal',
  onClick,
  className,
}) => {
  const colorClasses = COLOR_MAP[iconColor] ?? COLOR_MAP.primary;
  const sizeClasses = ICON_SIZE_MAP[iconSize] ?? ICON_SIZE_MAP.md;
  const isPrimary = variant === 'primary';

  const trendColorClass =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-light-text-secondary dark:text-dark-text-secondary';

  const trendIconName =
    trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'remove';

  const badgeColorClass = {
    optimal: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    elevated: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    low: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    normal: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
    neutral: 'bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary border-black/5 dark:border-white/5',
  }[badgeVariant];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative glass-tile p-4 sm:p-5 rounded-2xl transition-all duration-200',
        'flex flex-col justify-between',
        'min-h-[115px] sm:min-h-[125px]',
        'overflow-hidden select-none',
        onClick ? 'cursor-pointer' : 'cursor-default',
        isPrimary
          ? cn('hover:-translate-y-1', colorClasses.border, colorClasses.glow, 'bg-white/70 dark:bg-dark-card/85')
          : 'hover:-translate-y-0.5 hover:shadow-md shadow-card border border-slate-200/80 dark:border-white/10',
        className
      )}
    >
      {/* Background ghost icon for depth */}
      <div
        className={cn(
          'absolute -right-3 -bottom-3 pointer-events-none transition-transform group-hover:scale-110 duration-500',
          isPrimary ? 'opacity-[0.04] dark:opacity-[0.07]' : 'opacity-[0.025] dark:opacity-[0.04]'
        )}
        aria-hidden="true"
      >
        <Icon name={icon} className="text-7xl" />
      </div>

      {/* Primary Ambient Light Ring */}
      {isPrimary && (
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none blur-3xl opacity-30 dark:opacity-20"
          style={{ background: `radial-gradient(circle, var(--primary-500, #fa9a1d) 0%, transparent 70%)` }}
          aria-hidden="true"
        />
      )}

      {/* Top row: icon container + label + optional badge */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* Icon container — DESIGN.md controls tier: rounded-xl */}
        <div
          className={cn(
            sizeClasses.container,
            'rounded-xl border flex items-center justify-center shrink-0',
            'transition-transform duration-200 group-hover:scale-105',
            colorClasses.container
          )}
        >
          <Icon name={icon} className={cn(sizeClasses.icon, colorClasses.icon)} />
        </div>

        {/* Right side: Badge or Kicker label */}
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          {badgeText && (
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0', badgeColorClass)}>
              {badgeText}
            </span>
          )}
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-75 text-right leading-tight min-w-0 truncate">
            {label}
          </p>
        </div>
      </div>

      {/* Value */}
      <div className="relative z-10 mt-2.5">
        <p
          className={cn(
            'font-black font-mono tracking-tight leading-tight text-light-text dark:text-dark-text transition-colors duration-200',
            isPrimary ? 'text-3xl sm:text-4xl text-light-text dark:text-white' : 'text-2xl sm:text-3xl',
            'group-hover:text-primary-500',
            privacyBlur && 'privacy-blur'
          )}
        >
          {value}
        </p>
      </div>

      {/* Footer: subtext or trend */}
      {(subtext || (trend && trendValue)) && (
        <div className="relative z-10 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5">
          {trend && trendValue ? (
            <div className={cn('flex items-center gap-1', trendColorClass)}>
              <Icon name={trendIconName} className="text-xs shrink-0" />
              <span className="text-[10px] font-semibold truncate">{trendValue}</span>
            </div>
          ) : (
            <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 leading-normal truncate">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default HeroMetricCard;
