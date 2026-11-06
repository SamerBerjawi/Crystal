import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { DisplayTransaction } from '../types';
import { convertToMain, formatCurrency, parseLocalDate, getMainCurrency, currencySign, toLocalISOString } from '../utils';
import { addDays } from '../utils/scheduleModel';
import { useIsDark } from '../hooks/useIsDark';
import { cn } from '../lib/utils';
import { adaptColorForTheme } from './EntityIcon';
import SegmentedControl from './ui/SegmentedControl';

const DAY = 86_400_000;
const PAD = { top: 18, right: 14, bottom: 26, left: 56 };
const MIN_PLOT = 240;
const MAX_POINTS = 1500;
/** The amount at the centre line. Anything smaller sits on it. */
const FLOOR = 10;
const TICKS = [100, 1000, 10000, 100000, 1000000];
const DRAG_SLOP = 4;

export interface ScatterBrush { from: string; to: string }

type WindowChoice = 'auto' | '30' | '91' | 'all';

interface Dot {
  tx: DisplayTransaction;
  day: number;
  amount: number;
  isIncome: boolean;
  color: string;
}

const compactMoney = (value: number) => `${currencySign(getMainCurrency())}${value >= 1000 ? `${value / 1000}k` : value}`;

const fmtDay = (date: Date, withMonth: boolean) => date.toLocaleDateString(undefined, withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' });

/**
 * Every payment as a dot, by day: money in above the centre line and money out below it, each on its own log scale so
 * coffees and rent share one chart. A dot's size is its amount and its colour is its category. Drag across days to
 * look at just those (the list and the summary follow), drag the handles to change the stretch, click a day to pick it,
 * and click a dot to open the payment.
 */
const TransactionScatter: React.FC<{
  transactions: DisplayTransaction[];
  onOpen: (tx: DisplayTransaction) => void;
  /** Category name to its colour. Categories without one are drawn muted. */
  categoryColors?: Record<string, string>;
  /** The days picked on the chart. */
  brush?: ScatterBrush | null;
  onBrushChange?: (brush: ScatterBrush | null) => void;
  /** When the page already limits the dates, the chart shows that stretch whole. */
  hasDateFilter?: boolean;
  className?: string;
}> = ({ transactions, onOpen, categoryColors = {}, brush = null, onBrushChange, hasDateFilter = false, className }) => {
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const isDark = useIsDark();
  const [size, setSize] = useState({ width: 720, height: 340 });
  const [choice, setChoice] = useState<WindowChoice>('auto');
  const [hovered, setHovered] = useState<Dot | null>(null);
  const [live, setLive] = useState<{ a: number; b: number } | null>(null);
  const gesture = useRef<{ mode: 'new' | 'left' | 'right'; anchor: number; startX: number; moved: boolean; hit: string | null; from: number; to: number } | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) setSize({ width: Math.round(width), height: Math.max(MIN_PLOT, Math.round(height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const plotWidth = Math.max(100, width - PAD.left - PAD.right);
  const half = (height - PAD.top - PAD.bottom) / 2;
  const midY = PAD.top + half;

  const list = useMemo(() => transactions.filter(tx => !tx.isTransfer && !tx.parentTransactionId && !tx.isSplitParent && !tx.isCombinedParent), [transactions]);

  const today = useMemo(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }, []);

  // With nothing in the last 30 days, "auto" shows everything rather than an empty chart.
  const effective: Exclude<WindowChoice, 'auto'> = hasDateFilter ? 'all' : choice !== 'auto' ? choice : list.some(tx => parseLocalDate(tx.date).getTime() >= today.getTime() - 29 * DAY) ? '30' : 'all';

  const range = useMemo(() => {
    if (effective === '30' || effective === '91') {
      const days = effective === '30' ? 30 : 91;
      return { start: addDays(today, -(days - 1)), days };
    }
    if (list.length === 0) return { start: addDays(today, -29), days: 30 };
    const times = list.map(tx => parseLocalDate(tx.date).getTime());
    const start = new Date(Math.min(...times));
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = Math.max(Math.max(...times), startDay.getTime() + DAY);
    return { start: startDay, days: Math.round((end - startDay.getTime()) / DAY) + 1 };
  }, [effective, list, today]);

  const colW = plotWidth / range.days;
  const dayX = (day: number) => PAD.left + (day + 0.5) * colW;
  const dayOf = (iso: string) => Math.round((parseLocalDate(iso).getTime() - range.start.getTime()) / DAY);
  const isoOf = (day: number) => toLocalISOString(addDays(range.start, day));

  const { dots, top } = useMemo(() => {
    const inWindow: Dot[] = [];
    let largest = FLOOR * 10;
    for (const tx of list) {
      const day = Math.round((parseLocalDate(tx.date).getTime() - range.start.getTime()) / DAY);
      if (day < 0 || day >= range.days) continue;
      const amount = Math.max(1, Math.abs(convertToMain(tx.amount, tx.currency)));
      largest = Math.max(largest, amount);
      const raw = categoryColors[tx.category];
      const color = raw ? (adaptColorForTheme(raw, isDark) ?? raw) : 'var(--muted)';
      inWindow.push({ tx, day, amount, isIncome: tx.type === 'income', color });
    }
    // Biggest payments are drawn first, so small dots are never hidden under them.
    inWindow.sort((a, b) => b.amount - a.amount);
    return { dots: inWindow.slice(0, MAX_POINTS), top: Math.pow(10, Math.ceil(Math.log10(largest))) };
  }, [list, range, categoryColors, isDark]);

  const offsetOf = (amount: number) => (Math.log10(Math.max(amount, FLOOR) / FLOOR) / Math.log10(top / FLOOR)) * (half - 10);
  const yOf = (dot: Dot) => (dot.isIncome ? midY - offsetOf(dot.amount) : midY + offsetOf(dot.amount));
  const largestAmount = dots.length ? dots[0].amount : 1;
  const radiusOf = (amount: number) => 2.5 + 9.5 * Math.sqrt(amount / largestAmount);

  // Dots on one day and side fan out a little, so they do not sit exactly on one another.
  const spread = useMemo(() => {
    const counts = new Map<string, number>();
    const result = new Map<string, number>();
    [...dots].sort((a, b) => a.amount - b.amount).forEach(dot => {
      const key = `${dot.day}|${dot.isIncome}`;
      const n = counts.get(key) ?? 0;
      counts.set(key, n + 1);
      const step = [0, -1, 1, -2, 2][n % 5];
      result.set(dot.tx.id, colW > 10 ? step * Math.min(colW * 0.2, 5) : 0);
    });
    return result;
  }, [dots, colW]);

  const committed = brush ? { a: Math.max(0, dayOf(brush.from)), b: Math.min(range.days - 1, dayOf(brush.to)) } : null;
  const active = live ?? (committed && committed.b >= committed.a ? committed : null);
  const lo = active ? Math.min(active.a, active.b) : -1;
  const hi = active ? Math.max(active.a, active.b) : -1;
  const inBrush = (day: number) => !active || (day >= lo && day <= hi);

  const tickEvery = [1, 2, 3, 5, 7, 14, 30, 60, 90, 180, 365].find(step => step * colW >= 46) ?? 365;
  const todayDay = Math.round((today.getTime() - range.start.getTime()) / DAY);
  const showToday = todayDay >= 0 && todayDay < range.days;
  const yTicks = TICKS.filter(tick => tick <= top);

  const dayFromEvent = (event: React.PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const x = event.clientX - box.left - PAD.left;
    return Math.max(0, Math.min(range.days - 1, Math.floor(x / colW)));
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !svg.current) return;
    const target = event.target as Element;
    const box = svg.current.getBoundingClientRect();
    const localX = event.clientX - box.left;
    if (localX < PAD.left - 4 || localX > width - PAD.right + 4) return;
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as 'left' | 'right' | null;
    const hit = target.closest('[data-tx]')?.getAttribute('data-tx') ?? null;
    const day = dayFromEvent(event);
    if (handle && active) {
      gesture.current = { mode: handle, anchor: handle === 'left' ? hi : lo, startX: event.clientX, moved: true, hit: null, from: lo, to: hi };
      setLive({ a: handle === 'left' ? hi : lo, b: handle === 'left' ? lo : hi });
    } else {
      gesture.current = { mode: 'new', anchor: day, startX: event.clientX, moved: false, hit, from: day, to: day };
    }
    svg.current.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.abs(event.clientX - g.startX) > DRAG_SLOP) g.moved = true;
    if (!g.moved) return;
    setHovered(null);
    setLive({ a: g.anchor, b: dayFromEvent(event) });
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    svg.current?.releasePointerCapture(event.pointerId);
    if (g.moved) {
      const end = dayFromEvent(event);
      const from = Math.min(g.anchor, end);
      const to = Math.max(g.anchor, end);
      setLive(null);
      onBrushChange?.({ from: isoOf(from), to: isoOf(to) });
      return;
    }
    setLive(null);
    if (g.hit) {
      const dot = dots.find(item => item.tx.id === g.hit);
      if (dot) onOpen(dot.tx);
      return;
    }
    // A click on a day picks it; a click on the day that is already picked lets go of it.
    const same = committed && committed.a === g.anchor && committed.b === g.anchor;
    onBrushChange?.(same ? null : { from: isoOf(g.anchor), to: isoOf(g.anchor) });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && brush) onBrushChange?.(null);
  };

  if (list.length === 0) return null;

  const summary = `${dots.length} payments plotted by day and size, money in above the line and money out below. The list below has the same payments.`;
  const windowItems = [{ id: '30', label: '30 days' }, { id: '91', label: '13 weeks' }, { id: 'all', label: 'All' }];

  return (
    <section aria-label="Payments by day and size" className={cn('flex h-full flex-col rounded-[var(--radius-xl)] surface-card p-5', className)} onKeyDown={onKeyDown}>
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="type-card-title text-ink">Every payment</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="type-caption flex items-center gap-3 text-muted">
            <span className="flex items-center gap-1"><span aria-hidden className="size-1.5 rounded-full bg-muted" /><span aria-hidden className="size-2.5 rounded-full bg-muted" />bigger = more</span>
            <span className="flex items-center gap-1"><span aria-hidden className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} /><span aria-hidden className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} /><span aria-hidden className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />colour = category</span>
          </span>
          {!hasDateFilter && <SegmentedControl items={windowItems} activeId={effective} onChange={id => { setChoice(id as WindowChoice); onBrushChange?.(null); }} />}
        </div>
      </div>

      <div ref={frame} className="relative min-h-[260px] flex-1 select-none overflow-hidden">
        <svg
          ref={svg}
          role="img"
          aria-label={summary}
          width={width}
          height={height}
          className="block max-w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { gesture.current = null; setLive(null); }}
          onPointerLeave={() => setHovered(null)}
          style={{ cursor: gesture.current?.moved ? 'col-resize' : 'crosshair' }}
        >
          {/* A faint line for each stretch of days, and the scale on both sides of the centre line. */}
          {Array.from({ length: Math.floor(range.days / tickEvery) + 1 }, (_, i) => i * tickEvery).filter(day => day < range.days).map(day => (
            <line key={day} x1={dayX(day)} x2={dayX(day)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--line)" strokeOpacity={0.6} />
          ))}
          {yTicks.flatMap(tick => [-1, 1].map(side => {
            const y = midY + side * (Math.log10(tick / FLOOR) / Math.log10(top / FLOOR)) * (half - 10);
            return (
              <g key={`${tick}${side}`}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--line)" strokeOpacity={0.5} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--muted)">{compactMoney(tick)}</text>
              </g>
            );
          }))}
          <text x={PAD.left - 8} y={PAD.top - 4} textAnchor="end" fontSize={11} fontWeight={800} fill="var(--money-in)">In ↑</text>
          <text x={PAD.left - 8} y={height - PAD.bottom + 14} textAnchor="end" fontSize={11} fontWeight={800} fill="var(--money-out)">Out ↓</text>

          {/* The picked days. */}
          {active && (
            <g>
              <rect x={PAD.left + lo * colW} y={PAD.top} width={(hi - lo + 1) * colW} height={height - PAD.top - PAD.bottom} rx={8} fill="var(--amber)" fillOpacity={0.12} stroke="var(--amber)" strokeOpacity={0.6} strokeDasharray="4 3" />
            </g>
          )}

          <line x1={PAD.left} x2={width - PAD.right} y1={midY} y2={midY} stroke="var(--ink)" strokeOpacity={0.75} strokeWidth={1.5} />

          {showToday && (
            <g pointerEvents="none">
              <line x1={dayX(todayDay)} x2={dayX(todayDay)} y1={PAD.top} y2={height - PAD.bottom} stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="3 3" />
              <rect x={Math.min(dayX(todayDay) - 22, width - PAD.right - 44)} y={PAD.top - 14} width={44} height={16} rx={8} fill="var(--amber)" />
              <text x={Math.min(dayX(todayDay), width - PAD.right - 22)} y={PAD.top - 2} textAnchor="middle" fontSize={10} fontWeight={800} fill="var(--on-amber, var(--ink))">Today</text>
            </g>
          )}

          {Array.from({ length: Math.floor(range.days / tickEvery) + 1 }, (_, i) => i * tickEvery).filter(day => day < range.days).map(day => {
            const date = addDays(range.start, day);
            const first = day === 0 || date.getDate() <= tickEvery;
            return <text key={`l${day}`} x={dayX(day)} y={height - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--muted)">{fmtDay(date, first)}</text>;
          })}

          {dots.map(dot => {
            const x = dayX(dot.day) + (spread.get(dot.tx.id) ?? 0);
            const y = yOf(dot);
            const r = radiusOf(dot.amount);
            const faded = !inBrush(dot.day) || (hovered && hovered.tx.id !== dot.tx.id);
            return (
              <g key={dot.tx.id} data-tx={dot.tx.id} className="cursor-pointer" onPointerEnter={() => !gesture.current && setHovered(dot)} onPointerLeave={() => setHovered(current => (current?.tx.id === dot.tx.id ? null : current))}>
                <circle cx={x} cy={y} r={Math.max(r + 3, 8)} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill={dot.color} fillOpacity={faded ? 0.18 : 0.85} stroke="var(--solid)" strokeWidth={1} />
              </g>
            );
          })}

          {/* Handles on the centre line change the stretch. */}
          {active && (
            <>
              <rect data-handle="left" x={PAD.left + lo * colW - 4} y={midY - 11} width={8} height={22} rx={4} fill="var(--amber)" stroke="var(--solid)" strokeWidth={1.5} className="cursor-col-resize"><title>Drag to change the first day</title></rect>
              <rect data-handle="right" x={PAD.left + (hi + 1) * colW - 4} y={midY - 11} width={8} height={22} rx={4} fill="var(--amber)" stroke="var(--solid)" strokeWidth={1.5} className="cursor-col-resize"><title>Drag to change the last day</title></rect>
            </>
          )}
        </svg>

        {hovered && !live && (() => {
          const x = dayX(hovered.day) + (spread.get(hovered.tx.id) ?? 0);
          const y = yOf(hovered);
          const below = y < height / 2;
          return (
            <div
              className="glass-float pointer-events-none absolute z-10 w-max max-w-[240px] -translate-x-1/2 rounded-[var(--radius-sm)] px-2.5 py-1.5"
              style={{ left: Math.min(width - 125, Math.max(125, x)), top: below ? y + radiusOf(hovered.amount) + 8 : y - radiusOf(hovered.amount) - 8, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}
            >
              <p className="type-caption truncate font-bold text-ink">{hovered.tx.merchant || hovered.tx.description}</p>
              <p className="type-caption flex items-center gap-1.5 text-muted">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: hovered.color }} />
                <span className="truncate">{hovered.tx.category || 'Uncategorised'}</span>
              </p>
              <p className="type-caption text-ink privacy-blur">{hovered.isIncome ? '+' : '−'}{formatCurrency(hovered.amount, getMainCurrency())} · {parseLocalDate(hovered.tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
            </div>
          );
        })()}
      </div>

      <p className="type-caption mt-2 shrink-0 text-muted">
        One dot per payment, money in above the line and out below. Drag across days to look at just those, drag the handles to change them, click a day to pick it, and click a dot to open it.
      </p>
    </section>
  );
};

export default TransactionScatter;
