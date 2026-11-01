import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { formatCurrency, parseLocalDate } from '../utils';
import { addDays, iso } from '../utils/scheduleModel';
import type { Bubble, BubbleLane, ForecastDay } from '../utils/forecastModel';
import { cn } from '../lib/utils';

const EASE_IN_OUT_CUBIC = [0.645, 0.045, 0.355, 1] as const;
const PAD = { left: 56, right: 16 };
const LANE = 56;
const PLOT = 240;
const FIXED = 30;
const AXIS = 24;
const STACK_LIMIT = 3;
const MIN_RADIUS = 5;
const MAX_RADIUS = 13;
const HIT_RADIUS = 16;

const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const compact = (value: number) => (Math.abs(value) >= 1000 ? `€${Math.round(value / 100) / 10}k` : `€${Math.round(value)}`);

export interface ChartMarker { date: string; label: string }
export interface ChartLine { id: string; name: string; values: number[]; colour: string }

interface ForecastHorizonChartProps {
  days: ForecastDay[];
  bubbles: Bubble[];
  cushion: number;
  lowest: { value: number; date: string } | null;
  /** Replays the wipe when it changes. */
  revealKey: string;
  showBubbles: boolean;
  markers?: ChartMarker[];
  /** One line per account instead of the total. */
  lines?: ChartLine[];
  onOpen: (bubble: Bubble) => void;
  onOpenDay: (date: string) => void;
  onMove: (bubble: Bubble, toDate: string) => void;
}

const niceMax = (value: number) => {
  if (value <= 0) return 100;
  const step = 10 ** Math.floor(Math.log10(value));
  const fraction = value / step;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * step;
};

/** Talvo's cash horizon (D-010): the balance, your buffer, and everything that moves it as bubbles to drag. */
const ForecastHorizonChart: React.FC<ForecastHorizonChartProps> = ({ days, bubbles, cushion, lowest, revealKey, showBubbles, markers = [], lines, onOpen, onOpenDay, onMove }) => {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hovered, setHovered] = useState<Bubble | null>(null);
  const [drag, setDrag] = useState<{ bubble: Bubble; date: string; pointerId: number; moved: boolean } | null>(null);
  const [nudge, setNudge] = useState<{ key: string; date: string } | null>(null);

  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, []);

  const laneHeight = showBubbles ? LANE : 0;
  const fixedHeight = showBubbles ? FIXED : 0;
  const plotTop = laneHeight + 8;
  const plotBottom = plotTop + PLOT;
  const height = plotBottom + laneHeight + fixedHeight + AXIS + (showBubbles ? 8 : 0);
  const plotRight = Math.max(PAD.left + 1, width - PAD.right);

  const scale = useMemo(() => {
    const values = lines?.flatMap(line => line.values) ?? days.map(day => day.total);
    const top = niceMax(Math.max(...values, cushion, 1) * 1.05);
    const low = Math.min(...values, cushion, 0);
    const bottom = low < 0 ? -niceMax(-low * 1.05) : 0;
    const count = Math.max(1, days.length - 1);
    return {
      top,
      bottom,
      x: (index: number) => PAD.left + (index / count) * (plotRight - PAD.left),
      y: (value: number) => plotTop + (1 - (value - bottom) / (top - bottom)) * (plotBottom - plotTop),
      index: (x: number) => Math.max(0, Math.min(count, Math.round(((x - PAD.left) / Math.max(1, plotRight - PAD.left)) * count))),
    };
  }, [days, lines, cushion, plotRight, plotTop, plotBottom]);

  const indexOf = useMemo(() => new Map(days.map((day, index) => [day.date, index])), [days]);
  const pathOf = (values: number[]) => values.map((value, index) => `${index ? 'L' : 'M'}${scale.x(index).toFixed(1)},${scale.y(value).toFixed(1)}`).join(' ');
  const line = pathOf(days.map(day => day.total));
  const area = days.length ? `${line} L${scale.x(days.length - 1)},${plotBottom} L${scale.x(0)},${plotBottom} Z` : '';

  const ticks = useMemo(() => {
    const steps = width < 500 ? 3 : 6;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((i / steps) * Math.max(0, days.length - 1))).filter((value, i, all) => all.indexOf(value) === i);
  }, [days.length, width]);

  const placed = useMemo(() => {
    const largest = Math.max(1, ...bubbles.map(bubble => bubble.amount));
    const stacks = new Map<string, number>();
    return bubbles.flatMap(bubble => {
      const index = indexOf.get(bubble.date);
      if (index === undefined) return [];
      const stackKey = `${bubble.lane}|${bubble.date}`;
      const position = stacks.get(stackKey) ?? 0;
      stacks.set(stackKey, position + 1);
      if (position >= STACK_LIMIT) return [];
      const radius = MIN_RADIUS + Math.sqrt(bubble.amount / largest) * (MAX_RADIUS - MIN_RADIUS);
      return [{ bubble, radius, position }];
    });
  }, [bubbles, indexOf]);

  const laneY = (lane: BubbleLane, position: number) => {
    if (lane === 'in') return laneHeight - 12 - position * 18;
    if (lane === 'out') return plotBottom + 18 + position * 18;
    return plotBottom + laneHeight + fixedHeight / 2 + 2;
  };

  const dateAt = (clientX: number) => {
    const box = wrapper.current?.getBoundingClientRect();
    return days[scale.index(clientX - (box?.left ?? 0))]?.date;
  };

  const onBubbleKey = (e: React.KeyboardEvent, bubble: Bubble) => {
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (direction && bubble.isMovable) {
      e.preventDefault();
      const from = nudge?.key === bubble.key ? nudge.date : bubble.date;
      const next = iso(addDays(parseLocalDate(from), direction));
      if (indexOf.has(next)) setNudge({ key: bubble.key, date: next });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (nudge?.key === bubble.key && nudge.date !== bubble.date) onMove(bubble, nudge.date);
      else onOpen(bubble);
      setNudge(null);
    } else if (e.key === 'Escape') {
      setNudge(null);
    }
  };

  const hoverDay = hoverIndex !== null ? days[hoverIndex] : null;
  const guideDate = drag?.date ?? (nudge ? nudge.date : hovered?.date);
  const guideIndex = guideDate ? indexOf.get(guideDate) : undefined;

  return (
    <div ref={wrapper} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block" role="img" aria-label={`Balance forecast. ${lowest ? `Lowest point ${formatCurrency(lowest.value, 'EUR')} on ${shortDay(lowest.date)}.` : ''} The list has the same figures.`}>
          <defs>
            <linearGradient id="horizon-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
            <clipPath id="horizon-wipe">
              <motion.rect key={revealKey} x={0} y={0} height={height} initial={{ width: 0 }} animate={{ width }} transition={{ duration: 1.4, ease: EASE_IN_OUT_CUBIC }} />
            </clipPath>
          </defs>

          {[scale.bottom, (scale.top + scale.bottom) / 2, scale.top].map(value => (
            <g key={value}>
              <line x1={PAD.left} x2={plotRight} y1={scale.y(value)} y2={scale.y(value)} stroke="var(--line)" />
              <text x={PAD.left - 8} y={scale.y(value) + 4} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--muted)">{compact(value)}</text>
            </g>
          ))}
          {scale.bottom < 0 && <line x1={PAD.left} x2={plotRight} y1={scale.y(0)} y2={scale.y(0)} stroke="var(--line-strong)" />}

          <g clipPath="url(#horizon-wipe)">
            {lines ? (
              lines.map(item => <path key={item.id} d={pathOf(item.values)} fill="none" stroke={item.colour} strokeWidth={2} />)
            ) : (
              <>
                <path d={area} fill="url(#horizon-fill)" />
                <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} />
              </>
            )}
          </g>

          {cushion > 0 && (
            <g>
              <line x1={PAD.left} x2={plotRight} y1={scale.y(cushion)} y2={scale.y(cushion)} stroke="var(--tomato)" strokeWidth={1.5} strokeDasharray="5 4" />
              <text x={plotRight} y={scale.y(cushion) - 6} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--money-out)">Buffer {compact(cushion)}</text>
            </g>
          )}

          {markers.map(marker => {
            const index = indexOf.get(marker.date);
            if (index === undefined) return null;
            return (
              <g key={`${marker.date}-${marker.label}`}>
                <title>{marker.label}</title>
                <line x1={scale.x(index)} x2={scale.x(index)} y1={plotTop} y2={plotBottom} stroke="var(--chart-4)" strokeDasharray="2 3" />
                <path d={`M${scale.x(index)},${plotTop} l9,4 l-9,4 z`} fill="var(--chart-4)" />
              </g>
            );
          })}

          <g aria-hidden="true">
            <line x1={scale.x(0)} x2={scale.x(0)} y1={plotTop} y2={plotBottom} stroke="var(--ink)" strokeWidth={1.5} />
            {guideIndex !== undefined && <line x1={scale.x(guideIndex)} x2={scale.x(guideIndex)} y1={showBubbles ? 0 : plotTop} y2={plotBottom + laneHeight + fixedHeight} stroke="var(--line-strong)" strokeDasharray="3 3" />}
            {lowest && !lines && indexOf.has(lowest.date) && <circle cx={scale.x(indexOf.get(lowest.date)!)} cy={scale.y(lowest.value)} r={4.5} fill="var(--solid)" stroke="var(--primary)" strokeWidth={2} />}
            {hoverDay && <circle cx={scale.x(hoverIndex!)} cy={scale.y(hoverDay.total)} r={4.5} fill="var(--primary)" stroke="var(--solid)" strokeWidth={2} />}
          </g>

          <rect
            x={PAD.left}
            y={plotTop}
            width={Math.max(0, plotRight - PAD.left)}
            height={PLOT}
            fill="transparent"
            className="cursor-pointer outline-none"
            onPointerMove={e => setHoverIndex(scale.index(e.clientX - (wrapper.current?.getBoundingClientRect().left ?? 0)))}
            onPointerLeave={() => setHoverIndex(null)}
            onClick={e => { const date = dateAt(e.clientX); if (date) onOpenDay(date); }}
          />

          {showBubbles && (
            <>
              {placed.map(({ bubble, radius, position }) => {
                const shownDate = drag?.bubble.key === bubble.key ? drag.date : nudge?.key === bubble.key ? nudge.date : bubble.date;
                const x = scale.x(indexOf.get(shownDate) ?? 0);
                const y = laneY(bubble.lane, position);
                const fill = bubble.lane === 'in' ? 'var(--money-in)' : bubble.lane === 'out' ? 'var(--ink)' : 'var(--chart-1)';
                const name = `${bubble.label}, ${bubble.lane === 'in' ? 'in' : 'out'} ${formatCurrency(bubble.amount, 'EUR')}, ${shortDay(bubble.date)}${bubble.isMovable ? '. Use left and right arrows then Enter to move it' : ''}`;
                return (
                  <g
                    key={bubble.key}
                    role="button"
                    tabIndex={0}
                    aria-label={name}
                    className={cn('outline-none [&:focus-visible>.ring]:opacity-100', bubble.isMovable ? 'cursor-grab' : 'cursor-pointer')}
                    style={{ touchAction: bubble.isMovable ? 'none' : undefined }}
                    onPointerEnter={() => setHovered(bubble)}
                    onPointerLeave={() => setHovered(current => (current?.key === bubble.key ? null : current))}
                    onPointerDown={e => {
                      if (e.pointerType === 'touch' || !bubble.isMovable) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrag({ bubble, date: bubble.date, pointerId: e.pointerId, moved: false });
                    }}
                    onPointerMove={e => {
                      if (!drag || drag.bubble.key !== bubble.key) return;
                      const date = dateAt(e.clientX);
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
                    onClick={() => { if (!bubble.isMovable) onOpen(bubble); }}
                    onKeyDown={e => onBubbleKey(e, bubble)}
                    onBlur={() => setNudge(null)}
                  >
                    <circle cx={x} cy={y} r={HIT_RADIUS} fill="transparent" />
                    <circle className="ring opacity-0" cx={x} cy={y} r={radius + 3} fill="none" stroke="var(--focus)" strokeWidth={2} />
                    {bubble.lane === 'fixed'
                      ? <rect x={x - 7} y={y - 7} width={14} height={14} rx={4} fill={fill} />
                      : <circle cx={x} cy={y} r={radius} fill={fill} stroke="var(--solid)" strokeWidth={1.5} />}
                  </g>
                );
              })}
            </>
          )}

          {ticks.map(index => (
            <text key={index} x={scale.x(index)} y={height - 6} textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'} fontSize={12} fontWeight={600} fill="var(--muted)">
              {index === 0 ? 'Today' : shortDay(days[index].date)}
            </text>
          ))}
        </svg>
      )}

      {(hoverDay || hovered || drag) && width > 0 && (() => {
        const active = drag?.bubble ?? hovered;
        const anchorDate = drag?.date ?? active?.date ?? hoverDay?.date ?? '';
        const index = indexOf.get(anchorDate) ?? 0;
        return (
          <div
            className="glass-float pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 rounded-[var(--radius-sm)] px-3 py-2"
            style={{ left: Math.max(110, Math.min(width - 110, scale.x(index))), top: plotTop + 8 }}
          >
            <p className="type-caption text-muted">{drag ? 'Move to ' : ''}{shortDay(anchorDate)}</p>
            {active ? (
              <p className="type-label text-ink">{active.label}, {formatCurrency(active.amount, 'EUR')}</p>
            ) : (
              <p className="type-label text-ink">{formatCurrency(hoverDay!.total, 'EUR')}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ForecastHorizonChart;
