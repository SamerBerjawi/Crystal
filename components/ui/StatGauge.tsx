import React from 'react';
import { Gauge } from '../../src/components/charts';
import { cn } from '../../lib/utils';

export type GaugeTone = 'pine' | 'amber' | 'loss' | 'neutral';

const TONE_FILL: Record<GaugeTone, string> = {
  pine: 'var(--primary)',
  amber: 'var(--amber)',
  loss: 'var(--money-out)',
  neutral: 'var(--ink)',
};

const TRACK = 'var(--line-strong)';

interface StatGaugeProps {
  /** How full the gauge is, 0 to 100. */
  fill: number;
  tone?: GaugeTone;
  /** The figure in the middle, already formatted. */
  display: React.ReactNode;
  /** A short word under it. Colour is never the only signal, so this always says what the colour means. */
  caption?: string;
  /** Square size in pixels. */
  size?: number;
  /** Names the reading for screen readers. */
  label: string;
  className?: string;
}

/** A notch gauge (Bklit) with its reading in the middle: one value against a target, in the app's type and colours. */
export const StatGauge: React.FC<StatGaugeProps> = ({ fill, tone = 'pine', display, caption, size = 120, label, className }) => {
  const value = Math.max(0, Math.min(100, Number.isFinite(fill) ? fill : 0));
  return (
    <div role="img" aria-label={`${label}: ${typeof display === 'string' ? display : ''}${caption ? `, ${caption}` : ''}`} className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <Gauge
        value={value}
        width={size}
        height={size}
        totalNotches={size >= 140 ? 40 : 30}
        spacing={28}
        notchCornerRadius={2}
        notchLengthPercent={70}
        activeFill={TONE_FILL[tone]}
        inactiveFill={TRACK}
        inactiveFillOpacity={0.55}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" style={{ paddingTop: size * 0.06 }}>
        <span className={size >= 130 ? 'type-figure-lg text-ink' : 'type-figure-row text-ink'}>{display}</span>
        {caption && <span className="type-caption text-muted">{caption}</span>}
      </div>
    </div>
  );
};

/** The same gauge as a horizontal track, for a share of a limit. */
export const LinearGauge: React.FC<{ fill: number; tone?: GaugeTone; label: string; height?: number; className?: string }> = ({ fill, tone = 'pine', label, height = 14, className }) => {
  const value = Math.max(0, Math.min(100, Number.isFinite(fill) ? fill : 0));
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value)}%`} className={cn('w-full', className)}>
      <Gauge
        orientation="linear"
        value={value}
        totalNotches={36}
        spacing={30}
        notchCornerRadius={2}
        linearHeight={height}
        minWidth={120}
        activeFill={TONE_FILL[tone]}
        inactiveFill={TRACK}
        inactiveFillOpacity={0.55}
      />
    </div>
  );
};
