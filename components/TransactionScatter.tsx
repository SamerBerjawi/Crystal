import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DisplayTransaction } from '../types';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };
const MAX_POINTS = 400;
const RADIUS = 4;
const TICKS = [1, 10, 100, 1000, 10000, 100000];

interface Point {
  tx: DisplayTransaction;
  x: number;
  y: number;
  amount: number;
  isIncome: boolean;
}

/** Each dot is a transaction: when it happened, and how big it was. A log scale keeps coffees and rent on one chart. */
const TransactionScatter: React.FC<{ transactions: DisplayTransaction[]; onOpen: (tx: DisplayTransaction) => void }> = ({ transactions, onOpen }) => {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hovered, setHovered] = useState<Point | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { points, ticks, months, hasIncome } = useMemo(() => {
    const list = transactions.filter(tx => !tx.isTransfer && !tx.parentTransactionId).slice(0, MAX_POINTS);
    if (list.length === 0) return { points: [], ticks: [], months: [], hasIncome: false };

    const times = list.map(tx => parseLocalDate(tx.date).getTime());
    const amounts = list.map(tx => Math.max(1, Math.abs(convertToEur(tx.amount, tx.currency))));
    const start = Math.min(...times);
    const span = Math.max(Math.max(...times) - start, 86_400_000);
    const top = Math.log10(Math.max(10, ...amounts) * 1.2);
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const toY = (value: number) => PAD.top + plotHeight * (1 - Math.log10(value) / top);

    const months = new Map<string, number>();
    times.forEach(time => {
      const date = new Date(time);
      const first = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      if (first >= start) months.set(date.toLocaleDateString(undefined, { month: 'short' }), PAD.left + ((first - start) / span) * plotWidth);
    });

    return {
      points: list.map((tx, index): Point => ({
        tx,
        x: PAD.left + ((times[index] - start) / span) * plotWidth,
        y: toY(amounts[index]),
        amount: amounts[index],
        isIncome: tx.type === 'income',
      })),
      ticks: TICKS.filter(tick => Math.log10(tick) <= top).map(tick => ({ tick, y: toY(tick) })),
      months: [...months.entries()],
      hasIncome: list.some(tx => tx.type === 'income'),
    };
  }, [transactions, width]);

  if (points.length === 0) return null;

  const label = `${points.length} transactions plotted by date and size. The list below has the same transactions.`;

  return (
    <section aria-label="Transactions by date and size" className="rounded-[var(--radius-xl)] border border-line bg-surface p-5">
      <div className="mb-2 flex items-center justify-end gap-4">
        <span className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2 rounded-full bg-[var(--chart-3)]" />Spending</span>
        {hasIncome && <span className="type-caption flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2 rounded-full bg-money-in" />Income</span>}
      </div>
      <div ref={box} className="relative" onPointerLeave={() => setHovered(null)}>
        <svg role="img" aria-label={label} width={width} height={HEIGHT} className="block max-w-full">
          {ticks.map(({ tick, y }) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--line)" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--muted)">€{tick >= 1000 ? `${tick / 1000}k` : tick}</text>
            </g>
          ))}
          {months.map(([name, x]) => <text key={name} x={x} y={HEIGHT - 6} fontSize={12} fontWeight={600} fill="var(--muted)">{name}</text>)}
          {points.map(point => (
            <g key={point.tx.id}>
              <circle cx={point.x} cy={point.y} r={RADIUS} fill={point.isIncome ? 'var(--money-in)' : 'var(--chart-3)'} fillOpacity={hovered && hovered !== point ? 0.3 : 0.8} stroke="var(--surface)" strokeWidth={1} />
              <circle cx={point.x} cy={point.y} r={12} fill="transparent" className="cursor-pointer" onPointerEnter={() => setHovered(point)} onClick={() => onOpen(point.tx)} />
            </g>
          ))}
        </svg>
        {hovered && (
          <div
            className="glass-float pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-[var(--radius-sm)] px-2.5 py-1.5"
            style={{ left: Math.min(width - 110, Math.max(110, hovered.x)), top: hovered.y - 10 }}
          >
            <p className="type-caption truncate text-ink">{hovered.tx.merchant || hovered.tx.description}</p>
            <p className="type-caption text-muted privacy-blur">{formatCurrency(hovered.amount, 'EUR')}, {parseLocalDate(hovered.tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TransactionScatter;
