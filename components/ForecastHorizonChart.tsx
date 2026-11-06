import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { curveNatural } from '@visx/curve';
import { area as shapeArea } from 'd3-shape';
import { formatCurrency, parseLocalDate, getMainCurrency, currencySign } from '../utils';
import { addDays, iso } from '../utils/scheduleModel';
import type { Bubble, BubbleLane, ForecastDay } from '../utils/forecastModel';
import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from '../src/components/charts';
import { useChartHover, useChartStable, useYScale } from '../src/components/charts/chart-context';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { cn } from '../lib/utils';

const PAD = { left: 56, right: 16 };
const LANE = 56;
const DEFAULT_PLOT = 240;
const FIXED = 30;
const AXIS = 28;
const STACK_LIMIT = 3;
const MIN_RADIUS = 5;
const MAX_RADIUS = 13;
const HIT_RADIUS = 16;
const LABEL_ROWS = 3;
const ROW_HEIGHT = 24;

export const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const compact = (value: number) => {
  const sign = currencySign(getMainCurrency());
  return Math.abs(value) >= 1000 ? `${sign}${Math.round(value / 100) / 10}k` : `${sign}${Math.round(value)}`;
};
export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
export const labelWidth = (text: string) => Math.round(text.length * 6.6 + 22);

export interface ChartMarker { date: string; label: string }
export interface ChartLine { id: string; name: string; values: number[]; colour: string }

interface ForecastHorizonChartProps {
  days: ForecastDay[];
  bubbles: Bubble[];
  cushion: number;
  lowest: { value: number; date: string } | null;
  /** The day the forecast starts from. Defaults to the first day. */
  today?: string;
  /** Height of the plot itself, without the bubble lanes. */
  plotHeight?: number;
  /** Replays the wipe when it changes. */
  revealKey: string;
  showBubbles: boolean;
  /** Goal dates, each drawn as a labelled flag. */
  markers?: ChartMarker[];
  /** One line per account instead of the total. */
  lines?: ChartLine[];
  onOpen: (bubble: Bubble) => void;
  onOpenDay: (date: string) => void;
  onMove: (bubble: Bubble, toDate: string) => void;
}

/** The soft fill under the balance line. */
export const HorizonArea: React.FC<{ seriesKey: string; color: string }> = ({ seriesKey, color }) => {
  const { xAccessor, innerHeight, renderData } = useChartStable();
  const yScale = useYScale();
  const { xScale } = useChartStable();
  const id = useId().replace(/:/g, '');
  const path = useMemo(
    () => shapeArea<Record<string, unknown>>()
      .x(row => xScale(xAccessor(row)))
      .y0(innerHeight)
      .y1(row => yScale(Number(row[seriesKey])))
      .curve(curveNatural)(renderData) ?? '',
    [renderData, xScale, yScale, xAccessor, innerHeight, seriesKey]
  );
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${id}-fill)`} />
    </g>
  );
};

/** Remembers the day under the pointer, so a click can open it. */
const HoverSync: React.FC<{ target: React.MutableRefObject<string | null> }> = ({ target }) => {
  const { tooltipData } = useChartHover();
  const { xAccessor } = useChartStable();
  useEffect(() => {
    if (tooltipData?.point) target.current = iso(xAccessor(tooltipData.point));
  }, [tooltipData, xAccessor, target]);
  return null;
};

interface LayerProps {
  days: ForecastDay[];
  bubbles: Bubble[];
  lowest: ForecastHorizonChartProps['lowest'];
  today: string;
  markers: ChartMarker[];
  showBubbles: boolean;
  hasLines: boolean;
  /** The balance line colour, red when the forecast ends below where it starts. */
  colour: string;
  laneHeight: number;
  fixedHeight: number;
  onOpen: ForecastHorizonChartProps['onOpen'];
  onMove: ForecastHorizonChartProps['onMove'];
}

/**
 * Everything drawn on top of the lines: the Today marker, labelled goals, the lowest point, and the expected
 * transactions as bubbles with a dotted line down to the balance. Bubbles can be dragged, or moved with the arrow keys.
 */
const HorizonLayer: React.FC<LayerProps> = ({ days, bubbles, lowest, today, markers, showBubbles, hasLines, colour, laneHeight, fixedHeight, onOpen, onMove }) => {
  const { xScale, innerWidth, innerHeight, margin, width } = useChartStable();
  const yScale = useYScale();
  const [hovered, setHovered] = useState<Bubble | null>(null);
  const [drag, setDrag] = useState<{ bubble: Bubble; date: string; moved: boolean } | null>(null);
  const [nudge, setNudge] = useState<{ key: string; date: string } | null>(null);

  const daySet = useMemo(() => new Set(days.map(day => day.date)), [days]);
  const totals = useMemo(() => new Map(days.map(day => [day.date, day.total])), [days]);
  const xOf = (date: string) => xScale(parseLocalDate(date));

  const placed = useMemo(() => {
    const largest = Math.max(1, ...bubbles.map(bubble => bubble.amount));
    const stacks = new Map<string, number>();
    return bubbles.flatMap(bubble => {
      if (!daySet.has(bubble.date)) return [];
      const stackKey = `${bubble.lane}|${bubble.date}`;
      const position = stacks.get(stackKey) ?? 0;
      stacks.set(stackKey, position + 1);
      if (position >= STACK_LIMIT) return [];
      return [{ bubble, radius: MIN_RADIUS + Math.sqrt(bubble.amount / largest) * (MAX_RADIUS - MIN_RADIUS), position }];
    });
  }, [bubbles, daySet]);

  const laneY = (lane: BubbleLane, position: number) => {
    const below = innerHeight + AXIS;
    if (lane === 'in') return -20 - position * 18;
    if (lane === 'out') return below + 14 + position * 18;
    return below + laneHeight + fixedHeight / 2 + 2;
  };

  const dayAt = (event: React.PointerEvent<SVGElement>) => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return undefined;
    const at = xScale.invert(event.clientX - box.left - margin.left).getTime();
    let best: string | undefined;
    let distance = Infinity;
    for (const day of days) {
      const gap = Math.abs(parseLocalDate(day.date).getTime() - at);
      if (gap < distance) { distance = gap; best = day.date; }
    }
    return best;
  };

  const onBubbleKey = (e: React.KeyboardEvent, bubble: Bubble) => {
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (direction && bubble.isMovable) {
      e.preventDefault();
      const from = nudge?.key === bubble.key ? nudge.date : bubble.date;
      const next = iso(addDays(parseLocalDate(from), direction));
      if (daySet.has(next)) setNudge({ key: bubble.key, date: next });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (nudge?.key === bubble.key && nudge.date !== bubble.date) onMove(bubble, nudge.date);
      else onOpen(bubble);
      setNudge(null);
    } else if (e.key === 'Escape') {
      setNudge(null);
    }
  };

  const guideDate = drag?.date ?? nudge?.date ?? hovered?.date;
  const guideX = guideDate && daySet.has(guideDate) ? xOf(guideDate) : undefined;

  // Goal labels sit in rows along the top, so two goals close together don't print over each other.
  const goals = useMemo(() => {
    const ends: number[] = [];
    return markers
      .filter(marker => daySet.has(marker.date))
      .map(marker => ({ marker, x: xOf(marker.date) }))
      .sort((a, b) => a.x - b.x)
      .map(({ marker, x }) => {
        const full = `${clip(marker.label, 22)}, ${shortDay(marker.date)}`;
        const right = innerWidth - x - 6;
        const left = x - 6;
        const flip = labelWidth(full) > right && left > right;
        const text = clip(full, Math.max(6, Math.floor(((flip ? left : right) - 22) / 6.6)));
        const w = labelWidth(text);
        const start = Math.max(0, Math.min(flip ? x - 6 - w : x + 6, innerWidth - w));
        let row = ends.findIndex(end => start >= end + 6);
        if (row === -1) row = ends.length < LABEL_ROWS ? ends.length : -1;
        if (row >= 0) ends[row] = start + w;
        return { marker, x, text, w, start, row };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, daySet, xScale, innerWidth]);

  const todayX = daySet.has(today) ? xOf(today) : undefined;
  const todayFlip = todayX !== undefined && todayX + 6 + 52 > innerWidth;

  return (
    <g>
      {/* The zero line, so it is clear when the balance goes under it. */}
      {yScale(0) >= 0 && yScale(0) <= innerHeight && <line x1={0} x2={innerWidth} y1={yScale(0)} y2={yScale(0)} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.5} pointerEvents="none" />}

      {guideX !== undefined && (
        <line x1={guideX} x2={guideX} y1={showBubbles ? -laneHeight : 0} y2={innerHeight + AXIS + laneHeight + fixedHeight} stroke="var(--line-strong)" strokeDasharray="3 3" pointerEvents="none" />
      )}

      {/* Goals: a dashed amber line with a diamond and a name, so they can't be mistaken for Today. */}
      {goals.map(({ marker, x, text, w, start, row }) => (
        <g key={`${marker.date}-${marker.label}`}>
          <title>{`Goal: ${marker.label}, ${shortDay(marker.date)}`}</title>
          <line x1={x} x2={x} y1={0} y2={innerHeight} stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
          <path d={`M${x},0 l5,5 l-5,5 l-5,-5 z`} fill="var(--chart-4)" pointerEvents="none" />
          {row >= 0 && (
            <g transform={`translate(${start},${8 + (row + 1) * ROW_HEIGHT})`} pointerEvents="none">
              <rect width={w} height={20} rx={10} fill="var(--solid)" stroke="var(--chart-4)" strokeWidth={1.5} />
              <path d="M10,5 v10 M10,5 h7 l-2,2.5 l2,2.5 h-7" fill="none" stroke="var(--chart-4)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <text x={22} y={14} fontSize={11} fontWeight={700} fill="var(--ink)">{text}</text>
            </g>
          )}
        </g>
      ))}

      {/* Today: a solid ink line, a dot on the balance and a filled pill. */}
      {todayX !== undefined && (
        <g aria-hidden="true" pointerEvents="none">
          <line x1={todayX} x2={todayX} y1={0} y2={innerHeight} stroke="var(--ink)" strokeWidth={1.5} />
          {!hasLines && totals.has(today) && <circle cx={todayX} cy={yScale(totals.get(today)!)} r={5} fill="var(--ink)" stroke="var(--solid)" strokeWidth={2} />}
          <g transform={`translate(${todayFlip ? todayX - 6 - 52 : todayX + 6},8)`}>
            <rect width={52} height={20} rx={10} fill="var(--pill)" />
            <text x={26} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-pill)">Today</text>
          </g>
        </g>
      )}

      {/* The lowest point is always red, with its figure and day. */}
      {lowest && !hasLines && daySet.has(lowest.date) && (() => {
        const lx = xOf(lowest.date);
        const ly = yScale(lowest.value);
        const text = `${formatCurrency(lowest.value, getMainCurrency())} low, ${shortDay(lowest.date)}`;
        const w = labelWidth(text) - 8;
        const flip = ly < 44;
        const left = Math.max(0, Math.min(lx - w / 2, innerWidth - w));
        return (
          <g pointerEvents="none">
            <circle cx={lx} cy={ly} r={5} fill="var(--money-out)" stroke="var(--solid)" strokeWidth={2} />
            <g transform={`translate(${left},${flip ? ly + 12 : ly - 32})`}>
              <rect width={w} height={20} rx={10} fill="var(--money-out)" />
              <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--on-danger)">{text}</text>
            </g>
          </g>
        );
      })()}

      {showBubbles && placed.map(({ bubble, radius, position }) => {
        const shownDate = drag?.bubble.key === bubble.key ? drag.date : nudge?.key === bubble.key ? nudge.date : bubble.date;
        const x = xOf(shownDate);
        const y = laneY(bubble.lane, position);
        const fill = bubble.lane === 'in' ? 'var(--money-in)' : bubble.lane === 'out' ? 'var(--ink)' : 'var(--chart-1)';
        const reach = hasLines || !totals.has(shownDate) ? (bubble.lane === 'in' ? 0 : innerHeight) : yScale(totals.get(shownDate)!);
        const name = `${bubble.label}, ${bubble.lane === 'in' ? 'in' : 'out'} ${formatCurrency(bubble.amount, getMainCurrency())}, ${shortDay(bubble.date)}${bubble.isMovable ? '. Use left and right arrows then Enter to move it' : ''}`;
        return (
          <g key={bubble.key}>
            {/* A dotted line ties the expected transaction to the balance it changes. */}
            <line x1={x} x2={x} y1={y} y2={reach} stroke={fill} strokeWidth={1.5} strokeOpacity={0.55} strokeDasharray="0.1 5" strokeLinecap="round" pointerEvents="none" />
            <g
              role="button"
              tabIndex={0}
              aria-label={name}
              className={cn('outline-hidden [&:focus-visible>.ring]:opacity-100', bubble.isMovable ? 'cursor-grab' : 'cursor-pointer')}
              style={{ touchAction: bubble.isMovable ? 'none' : undefined }}
              onPointerEnter={() => setHovered(bubble)}
              onPointerLeave={() => setHovered(current => (current?.key === bubble.key ? null : current))}
              onPointerDown={e => {
                if (e.pointerType === 'touch' || !bubble.isMovable) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ bubble, date: bubble.date, moved: false });
              }}
              onPointerMove={e => {
                if (!drag || drag.bubble.key !== bubble.key) return;
                const date = dayAt(e);
                if (date && date !== drag.date) setDrag({ ...drag, date, moved: true });
              }}
              onPointerUp={() => {
                if (drag?.bubble.key !== bubble.key) return;
                const { date, moved } = drag;
                setDrag(null);
                if (moved && date !== bubble.date) onMove(bubble, date);
                else if (!moved) onOpen(bubble);
              }}
              onPointerCancel={() => setDrag(null)}
              onClick={e => { e.stopPropagation(); if (!bubble.isMovable) onOpen(bubble); }}
              onKeyDown={e => onBubbleKey(e, bubble)}
              onBlur={() => setNudge(null)}
            >
              <circle cx={x} cy={y} r={HIT_RADIUS} fill="transparent" />
              <circle className="ring opacity-0" cx={x} cy={y} r={radius + 3} fill="none" stroke="var(--focus)" strokeWidth={2} />
              {bubble.lane === 'fixed'
                ? <rect x={x - 7} y={y - 7} width={14} height={14} rx={4} fill={fill} />
                : <circle cx={x} cy={y} r={radius} fill={fill} stroke="var(--solid)" strokeWidth={1.5} />}
            </g>
          </g>
        );
      })}

      {(hovered || drag) && (() => {
        const active = drag?.bubble ?? hovered!;
        const date = drag?.date ?? active.date;
        const left = Math.max(110 - margin.left, Math.min(width - margin.left - 110, xOf(date)));
        return (
          <foreignObject x={left - 110} y={showBubbles ? 4 : 8} width={220} height={64} pointerEvents="none" style={{ overflow: 'visible' }}>
            <div className="mx-auto w-fit max-w-[220px] rounded-[var(--radius-sm)] border border-line bg-solid px-3 py-2 shadow-[var(--elev-sm)]">
              <p className="type-caption text-muted">{drag ? 'Move to ' : ''}{shortDay(date)}</p>
              <p className="type-label truncate text-ink">{active.label}, {formatCurrency(active.amount, getMainCurrency())}</p>
            </div>
          </foreignObject>
        );
      })()}
    </g>
  );
};
(HorizonLayer as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/** The cash horizon (D-010): the balance, your buffer, and everything that moves it as bubbles to drag. */
const ForecastHorizonChart: React.FC<ForecastHorizonChartProps> = ({ days, bubbles, cushion, lowest, today, plotHeight = DEFAULT_PLOT, revealKey, showBubbles, markers = [], lines, onOpen, onOpenDay, onMove }) => {
  const hovered = useRef<string | null>(null);

  const laneHeight = showBubbles ? LANE : 0;
  const fixedHeight = showBubbles ? FIXED : 0;
  const margin = { top: showBubbles ? laneHeight + 8 : 12, right: PAD.right, bottom: AXIS + (showBubbles ? laneHeight + fixedHeight + 8 : 0), left: PAD.left };
  const height = margin.top + plotHeight + margin.bottom;

  const data = useMemo(() => days.map((day, index) => {
    const row: Record<string, unknown> = { date: parseLocalDate(day.date), total: day.total, buffer: cushion };
    lines?.forEach(line => { row[line.id] = line.values[index]; });
    return row;
  }), [days, lines, cushion]);

  const startAt = Math.max(0, days.findIndex(day => day.date === (today ?? days[0]?.date)));
  const colour = days.length > 1 && days[days.length - 1].total < days[startAt].total ? 'var(--money-out)' : 'var(--primary)';

  const summary = `Balance forecast. ${lowest ? `Lowest point ${formatCurrency(lowest.value, getMainCurrency())} on ${shortDay(lowest.date)}.` : ''} The list has the same figures.`;

  return (
    <div className="relative w-full select-none" style={{ height }} role="img" aria-label={summary} onPointerLeave={() => { hovered.current = null; }} onClick={() => { if (hovered.current) onOpenDay(hovered.current); }}>
      <LineChart data={data} margin={margin} animationDuration={1400} revealSignature={revealKey} style={{ height, width: '100%' }}>
        <Grid horizontal numTicksRows={3} />
        {!lines && <SpotlightIndicator seriesKey="total" color={colour} />}
        {!lines && <HorizonArea seriesKey="total" color={colour} />}
        {cushion > 0 && <Line dataKey="buffer" label="Buffer" stroke="var(--tomato)" strokeWidth={1.5} strokeDasharray="5,4" curve={curveNatural} fadeEdges={false} showHighlight={false} />}
        {lines
          ? lines.map(line => <Line key={line.id} dataKey={line.id} label={line.name} stroke={line.colour} strokeWidth={2} curve={curveNatural} fadeEdges={false} />)
          : <Line dataKey="total" label="Balance" stroke={colour} strokeWidth={2} curve={curveNatural} fadeEdges={false} />}
        <XAxis numTicks={5} />
        <YAxis numTicks={3} tickFormatter={compact} />
        <HoverSync target={hovered} />
        <HorizonLayer
          days={days}
          bubbles={bubbles}
          lowest={lowest}
          today={today ?? days[0]?.date ?? ''}
          markers={markers}
          showBubbles={showBubbles}
          hasLines={!!lines}
          colour={colour}
          laneHeight={laneHeight}
          fixedHeight={fixedHeight}
          onOpen={onOpen}
          onMove={onMove}
        />
        <ChartTooltip
          showCrosshair={false}
          rows={point => [
            ...(lines
              ? lines.map(line => ({ color: line.colour, label: line.name, value: formatCurrency(Number(point[line.id]), getMainCurrency()) }))
              : [{ color: colour, label: 'Balance', value: formatCurrency(Number(point.total), getMainCurrency()) }]),
            ...(cushion > 0 ? [{ color: 'var(--tomato)', label: 'Buffer', value: formatCurrency(cushion, getMainCurrency()) }] : []),
          ]}
        />
      </LineChart>
    </div>
  );
};

export default ForecastHorizonChart;
