import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { Currency } from '../../../types';
import { formatCurrency } from '../../../utils';
import type { BudgetLine, BudgetStatus, GoalView, Pace, Slice } from '../../../utils/budgetModel';
import { Gauge, PieCenter, PieChart, PieSlice, type PieData } from '../../bklit/charts';
import { EntityGlyph } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, IconButton, Money, type Accent } from '../ui';

/*
 * Pieces of BudgetNew (UI_UX_DESIGN_REFERENCE.md §5.1, R8): the dark ring gauge, dot-matrix days, the pace bar,
 * budget rows, the allocation ring and concentric goal rings. Plain SVG: no KokonutUI part covers these (D13);
 * Liquid Gauge and Apple Activity Card are not ported, and these follow R8's adopted chart set instead.
 * Fills animate in once with CSS transitions, which the reduced-motion rule in new.css turns off.
 */

/** False on the first frame, then true: lets a fill transition in from empty. */
const useEntered = () => {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return entered;
};

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Fill colour for a share used: violet, orange from 85%, red past the limit. */
export const usageColor = (pct: number) => (pct > 100 ? 'var(--nv-red)' : pct >= 85 ? 'var(--nv-orange)' : 'var(--nv-violet)');

/* ── Status ─────────────────────────────────────────────────────────────── */

const STATUS: Record<Exclude<BudgetStatus, 'ok'>, { label: string; tone: 'red' | 'orange' | 'sky'; icon: NvIconName }> = {
  over: { label: 'Over', tone: 'red', icon: 'alert' },
  near: { label: 'Near limit', tone: 'orange', icon: 'warning' },
  ahead: { label: 'Ahead of pace', tone: 'sky', icon: 'forecast' },
};

/** Attention badge (Q5, D12): only for a budget that needs a look, always with an icon. */
export const StatusBadge: React.FC<{ status: BudgetStatus; className?: string }> = ({ status, className }) =>
  status === 'ok' ? null : <Badge tone={STATUS[status].tone} icon={STATUS[status].icon} className={className}>{STATUS[status].label}</Badge>;

/* ── Category disc ──────────────────────────────────────────────────────── */

/** The category's icon in its colour on a soft tint of the same colour. */
export const CategoryDisc: React.FC<{ name: string; color?: string; icon?: string; size?: number }> = ({ name, color, icon, size = 44 }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-full bg-nv-surface"
    style={{ width: size, height: size, background: color ? `color-mix(in srgb, ${color} 16%, transparent)` : undefined }}
    aria-hidden
  >
    <EntityGlyph icon={icon} label={name} color={color} size={Math.round(size * 0.45)} />
  </span>
);

/* ── Budget spend gauge (bklit/gauge-chart) ─────────────────────────────── */

/**
 * A notched radial gauge from bklit/gauge-chart displaying budget spend percentage.
 * Over budget limit, the active notches transition to red.
 */
export const RingGauge: React.FC<{
  pct: number;
  elapsedPct?: number;
  label: string;
  size?: number;
  activeFill?: string;
}> = ({
  pct,
  label,
  size = 184,
  activeFill,
}) => {
  const shown = Math.max(0, Math.min(100, pct));
  const activeColor = activeFill ?? usageColor(pct);

  return (
    <div
      role="img"
      aria-label={`${Math.round(pct)}% ${label}`}
      className="relative flex shrink-0 items-center justify-center text-nv-ink"
      style={{ width: size, height: size }}
    >
      <Gauge
        value={shown}
        totalNotches={32}
        spacing={24}
        notchCornerRadius={3}
        uniformWidth={true}
        notchLengthPercent={90}
        width={size}
        height={size}
        startAngle={135}
        endAngle={405}
        activeFill={activeColor}
        inactiveFill="var(--nv-inset)"
        inactiveFillOpacity={1}
        centerValue={Math.round(pct)}
        suffix="%"
        defaultLabel={label}
        className="size-full"
      />
    </div>
  );
};

/* ── Dot-matrix days (R8) ───────────────────────────────────────────────── */

/** One dot per day of the month: gone (ink), today (violet), still to come (grey). */
export const DayDots: React.FC<{ pace: Pace; className?: string }> = ({ pace, className }) => {
  const today = pace.when === 'current' ? pace.elapsed : -1;
  const gone = pace.when === 'past' ? pace.days : pace.when === 'current' ? pace.elapsed - 1 : 0;
  return (
    <div role="img" aria-label={pace.when === 'current' ? `Day ${pace.elapsed} of ${pace.days}` : pace.when === 'past' ? 'Month ended' : 'Month not started'} className={cn('grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5', className)}>
      {Array.from({ length: pace.days }, (_, i) => {
        const day = i + 1;
        return (
          <span
            key={day}
            className={cn(
              'aspect-square w-full max-w-3 rounded-full transition-colors',
              day === today ? 'bg-nv-violet ring-2 ring-nv-violet/30' : day <= gone ? 'bg-nv-ink' : 'bg-nv-inset',
            )}
            aria-hidden
          />
        );
      })}
    </div>
  );
};

/* ── Pace bar ───────────────────────────────────────────────────────────── */

/**
 * Spent as a gradient bar (R10: gradient on data marks only), with a marker where an even pace would be today.
 * Past the limit the bar turns red.
 */
export const PaceBar: React.FC<{ pct: number; elapsedPct?: number; className?: string; thin?: boolean; color?: string }> = ({ pct, elapsedPct, className, thin, color }) => {
  const entered = useEntered();
  const over = pct > 100;
  return (
    <div className={cn('relative', className)}>
      <div className={cn('overflow-hidden rounded-full bg-nv-inset', thin ? 'h-2' : 'h-3.5')}>
        <div
          className={cn('h-full rounded-full', !color && (over ? 'bg-nv-red' : 'nv-grad-h'))}
          style={{ width: entered ? `${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct))}%` : '0%', transition: `width 1000ms ${EASE}`, background: color && !over ? color : color && over ? 'var(--nv-red)' : undefined }}
        />
      </div>
      {elapsedPct !== undefined && elapsedPct > 0 && elapsedPct < 100 && (
        <span
          className={cn('absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-nv-ink', thin ? 'h-3.5' : 'h-6')}
          style={{ left: `${elapsedPct}%` }}
          aria-hidden
        />
      )}
    </div>
  );
};

/* ── Budget row ─────────────────────────────────────────────────────────── */

export const BudgetRow: React.FC<{
  line: BudgetLine; currency: Currency; color?: string; icon?: string; elapsedPct?: number; onOpen: () => void;
}> = ({ line, currency, color, icon, elapsedPct, onOpen }) => {
  const over = line.remaining < 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${line.name}: ${Math.round(line.pct)}% used. Edit budget`}
        className="group flex w-full items-center gap-3.5 rounded-nv-tile px-3 py-3.5 text-left transition-colors hover:bg-nv-tile sm:px-4"
      >
        <CategoryDisc name={line.name} color={color} icon={icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[15px] font-medium text-nv-ink">{line.name}</span>
            <span className={cn('shrink-0 text-[13px]', over ? 'text-nv-red-text' : 'text-nv-muted')}>
              <Money amount={Math.abs(line.remaining)} currency={currency} className={cn('text-[15px] font-semibold', over && 'text-nv-red-text')} />
              {over ? ' over' : ' left'}
            </span>
          </div>
          <PaceBar thin pct={line.pct} elapsedPct={elapsedPct} color={color} className="mt-2.5" />
          <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-nv-muted">
            <span className="truncate">
              <Money amount={line.spent} currency={currency} className="text-[13px] font-medium" /> of <Money amount={line.limit} currency={currency} className="text-[13px] font-medium" />
              <span className="nv-tabular"> · {Math.round(line.pct)}%</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <StatusBadge status={line.status} />
              <NvIcon name="arrowRight" size={16} className="text-nv-faint transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>
    </li>
  );
};

/* ── Allocation ring (bklit/pie-chart) ──────────────────────────────────── */

/** Each budget's share of the month as a donut using bklit/pie-chart, total in the middle. */
export const AllocationRing: React.FC<{
  slices: Slice[];
  colorOf: (name: string) => string;
  total: number;
  currency: Currency;
  size?: number;
}> = ({ slices, colorOf, total, currency, size = 220 }) => {
  const pieData = useMemo<PieData[]>(() => {
    return slices.map(s => ({
      label: s.name,
      value: s.value,
      color: colorOf(s.name),
    }));
  }, [slices, colorOf]);

  if (pieData.length === 0) return null;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <PieChart
        data={pieData}
        size={size}
        innerRadius={Math.round(size * 0.31)}
        cornerRadius={6}
        padAngle={pieData.length > 1 ? 0.04 : 0}
        hoverOffset={6}
        className="h-full w-full"
      >
        {pieData.map((_, index) => (
          <PieSlice key={index} index={index} showGlow />
        ))}
        <PieCenter defaultLabel="TOTAL">
          {({ value, label, isHovered }) => (
            <div className="flex flex-col items-center justify-center text-center px-1">
              <span className="truncate max-w-[130px] text-[11px] font-semibold uppercase tracking-wider text-nv-muted mb-0.5">
                {isHovered ? label : 'TOTAL'}
              </span>
              <span className="privacy-blur nv-tabular text-xl sm:text-2xl font-bold tracking-tight text-nv-ink">
                {formatCurrency(isHovered ? value : total, currency)}
              </span>
            </div>
          )}
        </PieCenter>
      </PieChart>
    </div>
  );
};

/* ── Goal rings (activity-style) ────────────────────────────────────────── */

export const GOAL_ACCENTS: Accent[] = ['violet', 'green', 'sky'];
const ACCENT_STROKE: Record<Accent, [string, string]> = {
  violet: ['var(--nv-violet)', 'var(--nv-violet-soft)'],
  green: ['var(--nv-green)', 'var(--nv-green-soft)'],
  sky: ['var(--nv-sky)', 'var(--nv-sky-soft)'],
  orange: ['var(--nv-orange)', 'var(--nv-orange-soft)'],
};

/** Up to three goals as concentric rings, outermost first. */
export const GoalRings: React.FC<{ goals: GoalView[]; size?: number; withLegend?: boolean }> = ({
  goals,
  size = 170,
  withLegend = false,
}) => {
  const entered = useEntered();
  const stroke = 14;
  const shown = goals.slice(0, 3);

  const ringSvg = (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
        role="img"
        aria-label={shown.map(g => `${g.name} ${Math.round(g.pct)}%`).join(', ')}
      >
        {shown.map((g, i) => {
          const r = size / 2 - stroke / 2 - i * (stroke + 5);
          const c = 2 * Math.PI * r;
          const [fill, track] = ACCENT_STROKE[GOAL_ACCENTS[i]];
          return (
            <g key={g.id}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={fill}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={entered ? c * (1 - Math.max(g.pct > 0 ? 1.5 : 0, g.pct) / 100) : c}
                style={{ transition: `stroke-dashoffset ${1000 + i * 150}ms ${EASE}` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-nv-muted">Top Goals</span>
        <span className="nv-tabular text-xs font-bold text-nv-ink">{shown.length} Rings</span>
      </div>
    </div>
  );

  if (!withLegend) return ringSvg;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {ringSvg}
      <div className="space-y-2 text-[12px]">
        {shown.map((g, i) => {
          const [fill] = ACCENT_STROKE[GOAL_ACCENTS[i]];
          return (
            <div key={g.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: fill }} aria-hidden />
              <span className="truncate max-w-[130px] font-medium text-nv-ink">{g.name}</span>
              <span className="nv-tabular text-nv-muted ml-auto font-semibold">{Math.round(g.pct)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Month navigator ────────────────────────────────────────────────────── */

export const MonthNav: React.FC<{ label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }> = ({ label, onPrev, onNext, onToday }) => (
  <div className="flex items-center gap-2">
    <div className="flex h-11 items-center rounded-full border border-nv-line bg-nv-surface">
      <IconButton icon="arrowLeft" label="Previous month" tone="plain" onClick={onPrev} />
      <span className="min-w-36 px-1 text-center text-sm font-medium text-nv-ink" aria-live="polite">{label}</span>
      <IconButton icon="arrowRight" label="Next month" tone="plain" onClick={onNext} />
    </div>
    {onToday && (
      <button type="button" onClick={onToday} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-nv-violet-text hover:bg-nv-violet-soft">
        <NvIcon name="calendar" size={16} />This month
      </button>
    )}
  </div>
);

/* ── Small figure cell ──────────────────────────────────────────────────── */

/** A label over a figure, with an optional note: the cells in a split tile's grey part. */
export const FigureCell: React.FC<{ icon: NvIconName; accent: Accent; label: string; children: React.ReactNode; note?: React.ReactNode }> = ({ icon, accent, label, children, note }) => {
  const tones: Record<Accent, string> = {
    violet: 'bg-nv-violet-soft text-nv-violet-text', green: 'bg-nv-green-soft text-nv-green-text',
    orange: 'bg-nv-orange-soft text-nv-orange-text', sky: 'bg-nv-sky-soft text-nv-sky-text',
  };
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tones[accent])} aria-hidden><NvIcon name={icon} size={18} /></span>
      <div className="min-w-0">
        <p className="text-[13px] text-nv-muted">{label}</p>
        <div className="mt-0.5 truncate">{children}</div>
        {note && <p className="mt-0.5 truncate text-[12px] text-nv-muted">{note}</p>}
      </div>
    </div>
  );
};
