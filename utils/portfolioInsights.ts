import type { Currency, InvestmentTransaction, PriceHistoryEntry, Warrant } from '../types';
import { safeAdd, safeRound } from '../utils';
import { dayOf } from './portfolioHistory';

/** Pure figures behind the Investments page: no React, no formatting. Money is in the main currency. */

export interface TreemapInput<T> { id: string; value: number; item: T }
export interface TreemapTile<T> extends TreemapInput<T> { x: number; y: number; w: number; h: number }

const worstRatio = (row: number[], side: number) => {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
};

/**
 * Squarified treemap (Bruls, Huizing, van Wijk) in a `width` × `height` box. Tiles keep the input's value order,
 * largest first works best. Zero and negative values are left out.
 */
export function squarify<T>(inputs: TreemapInput<T>[], width: number, height: number): TreemapTile<T>[] {
  const items = inputs.filter(input => input.value > 0).sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!items.length || width <= 0 || height <= 0 || total <= 0) return [];
  const scale = (width * height) / total;
  const areas = items.map(item => item.value * scale);
  const tiles: TreemapTile<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let start = 0;

  while (start < areas.length) {
    const side = Math.min(w, h);
    let end = start + 1;
    while (end < areas.length && worstRatio(areas.slice(start, end + 1), side) <= worstRatio(areas.slice(start, end), side)) end += 1;
    const row = areas.slice(start, end);
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // A column on the left.
      const colWidth = rowSum / h;
      let cy = y;
      row.forEach((area, index) => {
        const tileHeight = area / colWidth;
        tiles.push({ ...items[start + index], x, y: cy, w: colWidth, h: tileHeight });
        cy += tileHeight;
      });
      x += colWidth;
      w -= colWidth;
    } else {
      // A row along the top.
      const rowHeight = rowSum / w;
      let cx = x;
      row.forEach((area, index) => {
        const tileWidth = area / rowHeight;
        tiles.push({ ...items[start + index], x: cx, y, w: tileWidth, h: rowHeight });
        cx += tileWidth;
      });
      y += rowHeight;
      h -= rowHeight;
    }
    start = end;
  }
  return tiles;
}

type ToMain = (amount: number, currency: Currency) => number;
const tradeCurrency = (trade: InvestmentTransaction): Currency => (trade.currency ?? 'EUR') as Currency;
const isBuy = (trade: InvestmentTransaction) => trade.type?.toLowerCase() === 'buy';

/** YYYY-MM keys for the last `count` months, oldest first, ending with this month. */
export const recentMonths = (count: number, today = new Date()) => Array.from({ length: count }, (_, index) => {
  const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

export interface MonthFlow { month: string; bought: number; sold: number; granted: number; net: number }

/** Bought, sold and granted per month, in the main currency. */
export function monthlyFlows(trades: InvestmentTransaction[], grants: Warrant[], toMain: ToMain, months: string[], grantCurrency: Currency): MonthFlow[] {
  const rows = new Map(months.map(month => [month, { month, bought: 0, sold: 0, granted: 0, net: 0 }]));
  trades.forEach(trade => {
    const row = rows.get(dayOf(trade.date).slice(0, 7));
    if (!row) return;
    const amount = toMain(trade.quantity * trade.price, tradeCurrency(trade));
    if (isBuy(trade)) row.bought = safeAdd(row.bought, amount);
    else row.sold = safeAdd(row.sold, amount);
  });
  grants.forEach(grant => {
    const row = rows.get(dayOf(grant.grantDate).slice(0, 7));
    if (row) row.granted = safeAdd(row.granted, toMain(grant.quantity * grant.grantPrice, grantCurrency));
  });
  return months.map(month => {
    const row = rows.get(month)!;
    return { ...row, bought: safeRound(row.bought, 2), sold: safeRound(row.sold, 2), granted: safeRound(row.granted, 2), net: safeRound(row.bought + row.granted - row.sold, 2) };
  });
}

/**
 * Net money put in (buys and grants, less what sales returned) on each of `dates`, oldest first.
 * The line the value chart compares itself with.
 */
export function netInvestedOn(dates: string[], trades: InvestmentTransaction[], grants: Warrant[], toMain: ToMain, grantCurrency: Currency): number[] {
  const events = [
    ...trades.map(trade => ({ day: dayOf(trade.date), amount: (isBuy(trade) ? 1 : -1) * toMain(trade.quantity * trade.price, tradeCurrency(trade)) })),
    ...grants.map(grant => ({ day: dayOf(grant.grantDate), amount: toMain(grant.quantity * grant.grantPrice, grantCurrency) })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  let pointer = 0;
  let running = 0;
  return dates.map(date => {
    const day = dayOf(date);
    while (pointer < events.length && events[pointer].day <= day) {
      running = safeAdd(running, events[pointer].amount);
      pointer += 1;
    }
    return safeRound(running, 2);
  });
}

export interface Diversification {
  /** 1 / Σ w², the number of equal positions this spread is worth. */
  effective: number;
  count: number;
  topShare: number;
  top3Share: number;
  /** 0 to 100: effective positions against ten. */
  score: number;
  verdict: 'Concentrated' | 'Focused' | 'Balanced' | 'Well spread';
}

export function diversification(values: number[]): Diversification {
  const positive = values.filter(value => value > 0).sort((a, b) => b - a);
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { effective: 0, count: 0, topShare: 0, top3Share: 0, score: 0, verdict: 'Concentrated' };
  const weights = positive.map(value => value / total);
  const effective = 1 / weights.reduce((sum, weight) => sum + weight * weight, 0);
  const score = Math.min(100, (effective / 10) * 100);
  const verdict = effective < 2.5 ? 'Concentrated' : effective < 5 ? 'Focused' : effective < 9 ? 'Balanced' : 'Well spread';
  return {
    effective,
    count: positive.length,
    topShare: weights[0] * 100,
    top3Share: weights.slice(0, 3).reduce((sum, weight) => sum + weight, 0) * 100,
    score,
    verdict,
  };
}

export interface PriceRange { low: number; high: number; first: number; last: number; position: number; lowDate: string; highDate: string }

/** Low, high and where the latest price sits between them (0 to 100), over a price log. */
export function priceRange(log: PriceHistoryEntry[], current?: number): PriceRange | null {
  if (log.length < 2) return null;
  let low = log[0];
  let high = log[0];
  log.forEach(entry => {
    if (entry.price < low.price) low = entry;
    if (entry.price > high.price) high = entry;
  });
  const last = current ?? log[log.length - 1].price;
  const lowValue = Math.min(low.price, last);
  const highValue = Math.max(high.price, last);
  const position = highValue > lowValue ? ((last - lowValue) / (highValue - lowValue)) * 100 : 50;
  return { low: lowValue, high: highValue, first: log[0].price, last, position, lowDate: low.date, highDate: high.date };
}

/** Percentage change, or null when there is nothing to compare with. */
export const changePct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : null);
