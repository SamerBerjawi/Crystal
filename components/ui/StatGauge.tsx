import React from 'react';
import { Gauge } from '../../src/components/charts';
import type { ChartStatFlowFormat } from '../../src/components/charts/chart-stat-flow';
import { cn } from '../../lib/utils';

export type GaugeTone = 'pine' | 'amber' | 'loss' | 'neutral';

const TONE_GRADIENT: Record<GaugeTone, readonly [string, string]> = {
  pine: ['var(--primary)', 'var(--chart-3)'],
  amber: ['var(--amber)', 'var(--chart-4)'],
  loss: ['var(--money-out)', 'var(--chart-2)'],
  neutral: ['var(--chart-1)', 'var(--chart-3)'],
};

const INACTIVE_GRADIENT: readonly [string, string] = ['var(--line-strong)', 'var(--primary-soft)'];

interface StatGaugeProps {
  /** How full the gauge is, 0 to 100. */
  fill: number;
  tone?: GaugeTone;
  /** Optional custom accent color override (keeps striped notch gradient styling). */
  color?: string;
  /** The figure in the middle, already formatted. */
  display?: React.ReactNode;
  /** Optional numeric value rendered by Gauge's built-in center block. */
  centerValue?: number;
  /** Label passed to Gauge's built-in center block. */
  defaultLabel?: string;
  /** Number formatting options for `centerValue`. */
  formatOptions?: ChartStatFlowFormat;
  /** A short word under it. Colour is never the only signal, so this always says what the colour means. */
  caption?: string;
  /** Square size in pixels. */
  size?: number;
  /** Names the reading for screen readers. */
  label: string;
  className?: string;
}

/** A notch gauge (Bklit) with its reading in the middle: one value against a target, in the app's accent colours. */
export const StatGauge: React.FC<StatGaugeProps> = ({
  fill,
  tone = 'pine',
  color,
  display,
  centerValue,
  defaultLabel,
  formatOptions,
  caption,
  size = 120,
  label,
  className,
}) => {
  const value = Math.max(0, Math.min(100, Number.isFinite(fill) ? fill : 0));
  const accessibleReading = centerValue ?? (typeof display === 'string' || typeof display === 'number' ? display : '');
  const activeGradient: readonly [string, string] = color
    ? [`color-mix(in srgb, ${color} 72%, var(--ink))`, color]
    : TONE_GRADIENT[tone];
  const inactiveGradient: readonly [string, string] = color
    ? ['var(--line-strong)', `color-mix(in srgb, ${color} 28%, var(--inset))`]
    : INACTIVE_GRADIENT;
  return (
    <div
      role="img"
      aria-label={`${label}: ${accessibleReading}${caption ? `, ${caption}` : ''}`}
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <Gauge
        activeGradient={activeGradient}
        centerValue={centerValue}
        defaultLabel={defaultLabel ?? caption ?? label}
        endAngle={400}
        formatOptions={formatOptions}
        height={size}
        inactiveFillOpacity={0.4}
        inactiveGradient={inactiveGradient}
        notchCornerRadius={7}
        spacing={0}
        startAngle={140}
        useGradient
        value={value}
        width={size}
      />
      {centerValue === undefined && display !== undefined && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" style={{ paddingTop: size * 0.08 }}>
          <span className={cn('text-ink font-bold leading-tight', size >= 130 ? 'type-figure-lg' : 'type-figure-row')}>{display}</span>
          {caption && <span className="type-caption max-w-[85%] truncate text-muted leading-tight">{caption}</span>}
        </div>
      )}
    </div>
  );
};

/** The same gauge as a horizontal track, for a share of a limit. */
export const LinearGauge: React.FC<{ fill: number; tone?: GaugeTone; label: string; height?: number; className?: string }> = ({
  fill,
  tone = 'pine',
  label,
  height = 14,
  className,
}) => {
  const value = Math.max(0, Math.min(100, Number.isFinite(fill) ? fill : 0));
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value)}%`} className={cn('w-full', className)}>
      <Gauge
        activeGradient={TONE_GRADIENT[tone]}
        inactiveFillOpacity={0.4}
        inactiveGradient={INACTIVE_GRADIENT}
        linearHeight={height}
        minWidth={120}
        notchCornerRadius={7}
        orientation="linear"
        spacing={0}
        useGradient
        value={value}
      />
    </div>
  );
};
