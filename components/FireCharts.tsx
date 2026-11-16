import React, { useContext, useState } from 'react';
import { area as d3Area, curveNatural, line as d3Line } from 'd3-shape';
import { Amount, PrivacyContext } from './ui/Money';
import type { Cone } from '../utils/fireCone';

const W = 640;
const H = 240;
const PAD = { top: 14, right: 14, bottom: 28, left: 54 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

const compact = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** For each year you could stop working, the share of futures in which the money lasts. Press a year to look at it. */
export const OddsChart: React.FC<{ curve: Cone['curve']; target: number; chosen: number; onSelect: (years: number) => void }> = ({
  curve,
  target,
  chosen,
  onSelect,
}) => {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const last = Math.max(1, curve.length - 1);
  const x = (years: number) => PAD.left + (years / last) * innerW;
  const y = (odds: number) => PAD.top + (1 - odds) * innerH;
  const line = d3Line<Cone['curve'][number]>().x(p => x(p.years)).y(p => y(p.odds)).curve(curveNatural)(curve) ?? '';
  const area = d3Area<Cone['curve'][number]>().x(p => x(p.years)).y0(y(0)).y1(p => y(p.odds)).curve(curveNatural)(curve) ?? '';
  const pick = curve[Math.min(chosen, last)];
  const hovered = hoveredYear !== null ? curve[Math.min(hoveredYear, last)] : null;
  const xTicks = Array.from({ length: Math.floor(last / 5) + 1 }, (_, i) => i * 5);
  const baseYear = new Date().getFullYear();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-inset/50 px-3 py-1.5 text-xs">
        <span className="font-semibold text-ink">
          {(hovered ?? pick).years === 0
            ? `Stopping now (${baseYear})`
            : `In ${(hovered ?? pick).years} years (${baseYear + (hovered ?? pick).years})`}
        </span>
        <span className="font-bold text-primary">
          {Math.round((hovered ?? pick).odds * 100)}% chance money lasts
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Chance the money lasts, for each year you could stop working. Stopping in ${pick.years} years: ${Math.round(pick.odds * 100)}%.`}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{Math.round(v * 100)}%</text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>
            {t === 0 ? 'Now' : `${t}y`}
          </text>
        ))}
        <path d={area} fill="var(--primary)" fillOpacity={0.12} />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="4 4" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
        <line x1={x(pick.years)} x2={x(pick.years)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.5} />
        <circle cx={x(pick.years)} cy={y(pick.odds)} r={5} fill="var(--solid)" stroke="var(--primary)" strokeWidth={2.5} />
        {hovered && hovered.years !== pick.years && (
          <circle cx={x(hovered.years)} cy={y(hovered.odds)} r={4} fill="var(--amber)" stroke="var(--solid)" strokeWidth={1.5} />
        )}
        {curve.map(p => (
          <rect
            key={p.years}
            x={x(p.years) - innerW / last / 2}
            y={PAD.top}
            width={innerW / last}
            height={innerH}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredYear(p.years)}
            onMouseLeave={() => setHoveredYear(null)}
            onClick={() => onSelect(p.years)}
          >
            <title>{`Stop in ${p.years} years: ${Math.round(p.odds * 100)}% chance it lasts`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
};

/** The range of outcomes for one stopping year: the middle future, and the spread of the good and bad ones around it. */
export const FanChart: React.FC<{ fan: Cone['chosen']['fan']; retireAt: number; currency: string }> = ({ fan, retireAt, currency }) => {
  const isPrivate = useContext(PrivacyContext);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const last = Math.max(1, fan.length - 1);
  const max = Math.max(1, ...fan.map(p => p.p90)) * 1.05;
  const x = (year: number) => PAD.left + (year / last) * innerW;
  const y = (value: number) => PAD.top + (1 - value / max) * innerH;
  const path = (pick: (p: Cone['chosen']['fan'][number]) => number) =>
    d3Line<Cone['chosen']['fan'][number]>().x(p => x(p.year)).y(p => y(pick(p))).curve(curveNatural)(fan) ?? '';
  const band = (hi: (p: Cone['chosen']['fan'][number]) => number, lo: (p: Cone['chosen']['fan'][number]) => number) =>
    d3Area<Cone['chosen']['fan'][number]>().x(p => x(p.year)).y0(p => y(lo(p))).y1(p => y(hi(p))).curve(curveNatural)(fan) ?? '';
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(v => v * max);
  const xTicks = Array.from({ length: Math.floor(last / 10) + 1 }, (_, i) => i * 10);
  const baseYear = new Date().getFullYear();

  const shown = hoverIdx !== null ? fan[Math.min(hoverIdx, fan.length - 1)] : fan[fan.length - 1];

  const handleMove = (event: React.MouseEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = Math.max(0, Math.min(1, (relX - PAD.left) / innerW));
    setHoverIdx(Math.round(ratio * last));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-inset/50 px-3 py-1.5 text-xs">
        <span className="font-semibold text-ink">
          {shown.year === 0 ? `Today (${baseYear})` : `Year ${shown.year} (${baseYear + shown.year})`}
        </span>
        <div className="flex flex-wrap items-center gap-3 text-muted">
          <span>Poor (p10): <Amount value={shown.p10} currency={currency} className="font-semibold text-ink" /></span>
          <span>Median (p50): <Amount value={shown.p50} currency={currency} className="font-bold text-primary" /></span>
          <span>Strong (p90): <Amount value={shown.p90} currency={currency} className="font-semibold text-ink" /></span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Range of what the money could be worth over time: the middle outcome, and the spread from poor to good markets.">
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            {!isPrivate && (
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>
                {compact(v, currency)}
              </text>
            )}
          </g>
        ))}
        {xTicks.map(t => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>
            {t === 0 ? 'Now' : `${t}y`}
          </text>
        ))}
        <path d={band(p => p.p90, p => p.p10)} fill="var(--primary)" fillOpacity={0.12} />
        <path d={band(p => p.p75, p => p.p25)} fill="var(--primary)" fillOpacity={0.22} />
        <path d={path(p => p.p50)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
        {retireAt <= last && (
          <>
            <line x1={x(retireAt)} x2={x(retireAt)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.5} strokeDasharray="4 4" />
            <text x={x(retireAt) + 6} y={PAD.top + 10} className="fill-muted" fontSize={11}>Stop working</text>
          </>
        )}
        {hoverIdx !== null && (
          <g className="pointer-events-none">
            <line x1={x(shown.year)} x2={x(shown.year)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.35} strokeDasharray="3 3" />
            <circle cx={x(shown.year)} cy={y(shown.p50)} r={4.5} fill="var(--solid)" stroke="var(--primary)" strokeWidth={2.5} />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          className="cursor-crosshair"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>
    </div>
  );
};
