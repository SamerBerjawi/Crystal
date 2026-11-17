import React, { useContext, useEffect, useMemo, useState } from 'react';
import { area as d3Area, curveNatural } from 'd3-shape';
import type { Currency } from '../types';
import { formatCurrency } from '../utils';
import { ChartTooltip, Grid, Line, LineChart, LineSeriesTerminalMarker, XAxis, YAxis } from '../src/components/charts';
import { useChartHover, useChartStable, useYScale } from '../src/components/charts/chart-context';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { HorizonArea } from './ForecastHorizonChart';
import { Amount, PrivacyContext } from './ui/Money';
import type { Cone } from '../utils/fireCone';

const compact = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);

const OddsHoverSync: React.FC<{ onHover: (years: number | null) => void }> = ({ onHover }) => {
  const { tooltipData } = useChartHover();
  const years = tooltipData?.point && typeof tooltipData.point.years === 'number' ? tooltipData.point.years : null;
  useEffect(() => { onHover(years); }, [years, onHover]);
  return null;
};

const OddsTargetAndChosenOverlay: React.FC<{ target: number; chosenDate: Date; chosenPct: number }> = ({ target, chosenDate, chosenPct }) => {
  const { xScale, innerWidth, innerHeight } = useChartStable();
  const yScale = useYScale();
  const targetY = yScale(target * 100);
  const chosenX = xScale(chosenDate);
  const chosenY = yScale(chosenPct);

  return (
    <g pointerEvents="none">
      {Number.isFinite(targetY) && innerWidth > 0 && (
        <line x1={0} x2={innerWidth} y1={targetY} y2={targetY} stroke="var(--chart-positive)" strokeOpacity={0.55} strokeDasharray="4,4" />
      )}
      {Number.isFinite(chosenX) && Number.isFinite(chosenY) && (
        <>
          <line x1={chosenX} x2={chosenX} y1={0} y2={innerHeight} stroke="var(--ink)" strokeOpacity={0.4} strokeDasharray="3,3" />
          <circle cx={chosenX} cy={chosenY} r={5.5} fill="var(--surface)" stroke="var(--chart-positive)" strokeWidth={2.5} />
        </>
      )}
    </g>
  );
};
(OddsTargetAndChosenOverlay as React.FC<{ target: number; chosenDate: Date; chosenPct: number }> & { __isPostOverlay?: boolean }).__isPostOverlay = true;

/** For each year you could stop working, the share of futures in which the money lasts. Press a year to look at it. */
export const OddsChart: React.FC<{ curve: Cone['curve']; target: number; chosen: number; onSelect: (years: number) => void }> = ({
  curve,
  target,
  chosen,
  onSelect,
}) => {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const baseYear = new Date().getFullYear();
  const last = Math.max(0, curve.length - 1);
  const rows = useMemo(
    () => curve.map(p => ({ ...p, date: new Date(baseYear + p.years, 0, 1), pct: Math.round(p.odds * 100) })),
    [curve, baseYear]
  );

  if (rows.length === 0) return null;

  const pick = curve[Math.min(chosen, last)];
  const hovered = hoveredYear !== null ? curve[Math.min(hoveredYear, last)] : null;
  const shown = hovered ?? pick;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-inset/50 px-3 py-1.5 text-xs">
        <span className="font-semibold text-ink">
          {shown.years === 0
            ? `Stopping now (${baseYear})`
            : `In ${shown.years} years (${baseYear + shown.years})`}
        </span>
        <span className="font-bold" style={{ color: 'var(--chart-positive)' }}>
          {Math.round(shown.odds * 100)}% chance money lasts
        </span>
      </div>

      <div
        className="cursor-pointer"
        role="region"
        aria-label={`Chance the money lasts, for each year you could stop working. Stopping in ${pick.years} years: ${Math.round(pick.odds * 100)}%.`}
        onClick={() => { if (hoveredYear !== null) onSelect(hoveredYear); }}
      >
        <LineChart
          data={rows}
          xDataKey="date"
          yDomainTween
          aspectRatio=""
          className="h-[240px] w-full md:h-[260px]"
          margin={{ top: 16, right: 16, bottom: 28, left: 48 }}
        >
          <Grid horizontal numTicksRows={4} stroke="var(--line)" />
          <SpotlightIndicator seriesKey="pct" color="var(--chart-positive)" />
          <HorizonArea seriesKey="pct" color="var(--chart-positive)" curve={curveNatural} />
          <XAxis
            numTicks={5}
            tickMode="domain"
            tickFormatter={d => {
              const diff = (d instanceof Date ? d : new Date(d)).getFullYear() - baseYear;
              return diff === 0 ? 'Now' : `${diff}y`;
            }}
          />
          <YAxis numTicks={4} tickFormatter={v => `${Math.round(v)}%`} />
          <Line dataKey="pct" label="Success rate" stroke="var(--chart-positive)" strokeWidth={2.25} curve={curveNatural} fadeEdges={false} />
          <LineSeriesTerminalMarker dataKey="pct" stroke="var(--chart-positive)" fill="var(--chart-positive)" />
          <OddsHoverSync onHover={setHoveredYear} />
          <OddsTargetAndChosenOverlay target={target} chosenDate={new Date(baseYear + pick.years, 0, 1)} chosenPct={Math.round(pick.odds * 100)} />
          <ChartTooltip
            showCrosshair
            rows={point => [{
              color: 'var(--chart-positive)',
              label: Number(point.years) === 0 ? `Stopping now (${baseYear})` : `In ${point.years} years (${baseYear + Number(point.years)})`,
              value: `${point.pct}% chance money lasts`,
            }]}
          />
        </LineChart>
      </div>
    </div>
  );
};

const FanHoverSync: React.FC<{ onHover: (index: number | null) => void }> = ({ onHover }) => {
  const { tooltipData } = useChartHover();
  const index = tooltipData ? tooltipData.index : null;
  useEffect(() => { onHover(index); }, [index, onHover]);
  return null;
};

const FanBandsOverlay: React.FC<{ baseYear: number; retireAt: number; maxYear: number }> = ({ baseYear, retireAt, maxYear }) => {
  const { renderData, xAccessor, xScale, innerHeight } = useChartStable();
  const yScale = useYScale();

  const { outerBand, innerBand } = useMemo(() => {
    const outer = d3Area<Record<string, unknown>>()
      .x(row => xScale(xAccessor(row)))
      .y0(row => yScale(Number(row.p10 ?? 0)))
      .y1(row => yScale(Number(row.p90 ?? 0)))
      .curve(curveNatural)(renderData) ?? '';
    const inner = d3Area<Record<string, unknown>>()
      .x(row => xScale(xAccessor(row)))
      .y0(row => yScale(Number(row.p25 ?? 0)))
      .y1(row => yScale(Number(row.p75 ?? 0)))
      .curve(curveNatural)(renderData) ?? '';
    return { outerBand: outer, innerBand: inner };
  }, [renderData, xAccessor, xScale, yScale]);

  const retireX = retireAt >= 0 && retireAt <= maxYear ? xScale(new Date(baseYear + retireAt, 0, 1)) : null;

  return (
    <g pointerEvents="none">
      <path d={outerBand} fill="var(--primary)" fillOpacity={0.1} />
      <path d={innerBand} fill="var(--primary)" fillOpacity={0.18} />
      {retireX !== null && Number.isFinite(retireX) && (
        <>
          <line x1={retireX} x2={retireX} y1={0} y2={innerHeight} stroke="var(--muted)" strokeOpacity={0.65} strokeDasharray="3,3" />
          <text x={retireX + 6} y={12} className="fill-muted" fontSize={11}>Stop working</text>
        </>
      )}
    </g>
  );
};

/** The range of outcomes for one stopping year: the middle future, and the spread of the good and bad ones around it. */
export const FanChart: React.FC<{ fan: Cone['chosen']['fan']; retireAt: number; currency: string }> = ({ fan, retireAt, currency }) => {
  const isPrivate = useContext(PrivacyContext);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const baseYear = new Date().getFullYear();
  const rows = useMemo(
    () =>
      fan.map(p => ({
        ...p,
        date: new Date(baseYear + p.year, 0, 1),
        p10: Math.max(0, p.p10),
        p25: Math.max(0, p.p25),
        p50: Math.max(0, p.p50),
        p75: Math.max(0, p.p75),
        p90: Math.max(0, p.p90),
      })),
    [fan, baseYear]
  );

  if (rows.length === 0) return null;

  const shown = hoverIdx !== null ? fan[Math.min(hoverIdx, fan.length - 1)] : fan[fan.length - 1];
  const currencyTyped = currency as Currency;

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

      <div role="region" aria-label="Range of what the money could be worth over time: the middle outcome, and the spread from poor to good markets.">
        <LineChart
          data={rows}
          xDataKey="date"
          yDomainTween
          aspectRatio=""
          className="h-[240px] w-full md:h-[260px]"
          margin={{ top: 16, right: 16, bottom: 28, left: isPrivate ? 16 : 56 }}
        >
          <Grid horizontal numTicksRows={4} stroke="var(--line)" />
          <SpotlightIndicator seriesKey="p50" color="var(--primary)" />
          <HorizonArea seriesKey="p50" color="var(--primary)" curve={curveNatural} />
          <FanBandsOverlay baseYear={baseYear} retireAt={retireAt} maxYear={Math.max(0, fan.length - 1)} />
          <XAxis
            numTicks={5}
            tickMode="domain"
            tickFormatter={d => {
              const diff = (d instanceof Date ? d : new Date(d)).getFullYear() - baseYear;
              return diff === 0 ? 'Now' : `${diff}y`;
            }}
          />
          {!isPrivate && <YAxis numTicks={4} tickFormatter={v => compact(v, currency)} />}
          <Line dataKey="p90" label="90th percentile" stroke="var(--primary)" strokeWidth={1} strokeDasharray="3,3" curve={curveNatural} fadeEdges={false} />
          <Line dataKey="p75" label="75th percentile" stroke="var(--primary)" strokeWidth={1.25} strokeDasharray="2,2" curve={curveNatural} fadeEdges={false} />
          <Line dataKey="p50" label="Median (50th)" stroke="var(--primary)" strokeWidth={2.25} curve={curveNatural} fadeEdges={false} />
          <Line dataKey="p25" label="25th percentile" stroke="var(--chart-3)" strokeWidth={1.25} strokeDasharray="2,2" curve={curveNatural} fadeEdges={false} />
          <Line dataKey="p10" label="10th percentile" stroke="var(--amber)" strokeWidth={1.25} strokeDasharray="4,4" curve={curveNatural} fadeEdges={false} />
          <LineSeriesTerminalMarker dataKey="p50" stroke="var(--primary)" fill="var(--primary)" />
          <FanHoverSync onHover={setHoverIdx} />
          <ChartTooltip
            showCrosshair
            rows={point => [
              { color: 'var(--primary)', label: '75th percentile', value: isPrivate ? '•••' : formatCurrency(Number(point.p75 ?? 0), currencyTyped, { compact: true }) },
              { color: 'var(--primary)', label: 'Median (50th)', value: isPrivate ? '•••' : formatCurrency(Number(point.p50 ?? 0), currencyTyped) },
              { color: 'var(--amber)', label: '10th percentile', value: isPrivate ? '•••' : formatCurrency(Number(point.p10 ?? 0), currencyTyped, { compact: true }) },
            ]}
          />
        </LineChart>
      </div>
    </div>
  );
};
