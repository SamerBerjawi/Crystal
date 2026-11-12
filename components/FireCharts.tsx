import React, { useContext } from 'react';
import { PrivacyContext } from './ui/Money';
import type { Cone } from '../utils/fireCone';

const W = 640;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

const compact = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** For each year you could stop working, the share of futures in which the money lasts. Press a year to look at it. */
export const OddsChart: React.FC<{ curve: Cone['curve']; target: number; chosen: number; onSelect: (years: number) => void }> = ({ curve, target, chosen, onSelect }) => {
  const last = Math.max(1, curve.length - 1);
  const x = (years: number) => PAD.left + (years / last) * innerW;
  const y = (odds: number) => PAD.top + (1 - odds) * innerH;
  const line = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.years).toFixed(1)},${y(p.odds).toFixed(1)}`).join(' ');
  const area = `${line} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`;
  const pick = curve[Math.min(chosen, last)];
  const xTicks = Array.from({ length: Math.floor(last / 5) + 1 }, (_, i) => i * 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Chance the money lasts, for each year you could stop working. Stopping in ${pick.years} years: ${Math.round(pick.odds * 100)}%.`}>
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{Math.round(v * 100)}%</text>
        </g>
      ))}
      {xTicks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>{t === 0 ? 'Now' : `${t}y`}</text>)}
      <path d={area} fill="var(--primary)" fillOpacity={0.12} />
      <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="4 4" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={x(pick.years)} x2={x(pick.years)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.5} />
      <circle cx={x(pick.years)} cy={y(pick.odds)} r={5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2.5} />
      {curve.map(p => (
        <rect key={p.years} x={x(p.years) - innerW / last / 2} y={PAD.top} width={innerW / last} height={innerH} fill="transparent" className="cursor-pointer" onClick={() => onSelect(p.years)}>
          <title>{`Stop in ${p.years} years: ${Math.round(p.odds * 100)}% chance it lasts`}</title>
        </rect>
      ))}
    </svg>
  );
};

/** The range of outcomes for one stopping year: the middle future, and the spread of the good and bad ones around it. */
export const FanChart: React.FC<{ fan: Cone['chosen']['fan']; retireAt: number; currency: string }> = ({ fan, retireAt, currency }) => {
  const isPrivate = useContext(PrivacyContext);
  const last = Math.max(1, fan.length - 1);
  const max = Math.max(1, ...fan.map(p => p.p90)) * 1.05;
  const x = (year: number) => PAD.left + (year / last) * innerW;
  const y = (value: number) => PAD.top + (1 - value / max) * innerH;
  const path = (pick: (p: Cone['chosen']['fan'][number]) => number) => fan.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  const band = (hi: (p: Cone['chosen']['fan'][number]) => number, lo: (p: Cone['chosen']['fan'][number]) => number) =>
    `${path(hi)} ${[...fan].reverse().map(p => `L${x(p.year).toFixed(1)},${y(lo(p)).toFixed(1)}`).join(' ')} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(v => v * max);
  const xTicks = Array.from({ length: Math.floor(last / 10) + 1 }, (_, i) => i * 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Range of what the money could be worth over time: the middle outcome, and the spread from poor to good markets.">
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
          {!isPrivate && <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{compact(v, currency)}</text>}
        </g>
      ))}
      {xTicks.map(t => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>{t === 0 ? 'Now' : `${t}y`}</text>)}
      <path d={band(p => p.p90, p => p.p10)} fill="var(--primary)" fillOpacity={0.12} />
      <path d={band(p => p.p75, p => p.p25)} fill="var(--primary)" fillOpacity={0.2} />
      <path d={path(p => p.p50)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
      {retireAt <= last && (
        <>
          <line x1={x(retireAt)} x2={x(retireAt)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.5} strokeDasharray="4 4" />
          <text x={x(retireAt) + 6} y={PAD.top + 10} className="fill-muted" fontSize={11}>Stop working</text>
        </>
      )}
    </svg>
  );
};
