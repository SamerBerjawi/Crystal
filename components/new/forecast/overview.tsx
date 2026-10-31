import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { formatCurrency, parseLocalDate } from '../../../utils';
import { formatShortDate } from '../../../utils/dateFormat';
import {
  daysBelow, drivers, lowestPoint, lowestPoints, nextIncomeAfter, type Driver, type ForecastEvent,
} from '../../../utils/forecastModel';
import type { ForecastData } from '../../../hooks/useForecastData';
import { Area, AreaChart, Background, ChartTooltip, Line, LineChart, XAxis, curveMonotoneX } from '../../bklit/charts';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Card, Money, SegmentedTabs } from '../ui';

/* Forecasting Overview (docs/FORECASTING_NEW_PLAN.md §4.1): the lowest balance ahead, the chart (C1), the lowest point
 * of each period, what moves the line (N1) and what comes next. */

const DAY_MS = 86400000;
const daysFrom = (from: Date, date: string) => Math.round((parseLocalDate(date).getTime() - from.getTime()) / DAY_MS);
const LINE_COLORS = ['var(--chart-1)', 'var(--nv-sky)', 'var(--nv-green)', 'var(--nv-orange)', 'var(--nv-ink)', 'var(--nv-faint)'];

/** Maps a click on a chart to a date by its horizontal position (the charts have no click callback). */
const pickByPosition = (e: React.MouseEvent, dates: string[], onPick: (date: string) => void) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const i = Math.min(dates.length - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * dates.length)));
  if (dates[i]) onPick(dates[i]);
};

/** C1 (total): history solid, projection dashed from today; the scenario as a second line when one is on. */
const TotalChart: React.FC<{ data: ForecastData; onPickDay: (date: string) => void }> = ({ data, onPickDay }) => {
  const { points, todayIndex } = data.chart;
  const futureDates = points.map(p => p.iso);
  if (points.length < 2) return <p className="flex min-h-48 items-center justify-center text-sm text-nv-muted">Pick accounts to forecast</p>;
  return (
    <div className="cursor-pointer" onClick={e => pickByPosition(e, futureDates, date => { if (date >= futureDates[todayIndex]) onPickDay(date); })}>
      <AreaChart data={points as unknown as Record<string, unknown>[]} margin={{ top: 12, right: 8, bottom: 28, left: 8 }} aspectRatio="2.6 / 1" currency={data.displayCurrency} fitYDomain>
        <Background pattern="dots" opacity={0.85} />
        <Area dataKey="balance" curve={curveMonotoneX} fill="var(--chart-line-primary)" stroke="var(--chart-line-primary)" fillOpacity={0.14} strokeWidth={2.5} dashFromIndex={todayIndex} gradientToOpacity={0} />
        {data.scenario && <Area dataKey="scenario" curve={curveMonotoneX} fill="var(--nv-sky)" stroke="var(--nv-sky)" fillOpacity={0} strokeWidth={2} />}
        <XAxis numTicks={5} />
        <ChartTooltip currency={data.displayCurrency} showDatePill />
      </AreaChart>
    </div>
  );
};

/** C1b: one line per account (up to six, the rest as Other), projection only. */
const PerAccountChart: React.FC<{ data: ForecastData; onPickDay: (date: string) => void }> = ({ data, onPickDay }) => {
  const { series, rows } = useMemo(() => {
    const sorted = [...data.selectedAccounts].sort((a, b) => Math.abs(data.startBalances[b.id] ?? 0) - Math.abs(data.startBalances[a.id] ?? 0));
    const shown = sorted.slice(0, sorted.length > 6 ? 5 : 6);
    const rest = sorted.slice(shown.length);
    const keys = shown.map((a, i) => ({ key: `acc${i}`, label: a.name, ids: [a.id] }));
    if (rest.length) keys.push({ key: 'acc5', label: 'Other', ids: rest.map(a => a.id) });
    const points = data.projection.days.map(d => {
      const row: Record<string, unknown> = { date: parseLocalDate(d.date), iso: d.date };
      for (const k of keys) row[k.key] = Math.round(k.ids.reduce((s, id) => s + (d.byAccount[id] ?? 0), 0) * 100) / 100;
      return row;
    });
    return { series: keys, rows: points };
  }, [data.selectedAccounts, data.startBalances, data.projection]);
  const dates = rows.map(r => r.iso as string);
  return (
    <div>
      <div className="cursor-pointer" onClick={e => pickByPosition(e, dates, onPickDay)}>
        <LineChart data={rows} margin={{ top: 12, right: 8, bottom: 28, left: 8 }} aspectRatio="2.6 / 1" fitYDomain>
          <Background pattern="dots" opacity={0.85} />
          {series.map((s, i) => <Line key={s.key} dataKey={s.key} stroke={LINE_COLORS[i]} strokeWidth={2} curve={curveMonotoneX} />)}
          <XAxis numTicks={5} />
          <ChartTooltip
            currency={data.displayCurrency}
            showDatePill
            rows={point => series.map((s, i) => ({ color: LINE_COLORS[i], label: s.label, value: formatCurrency(Number(point[s.key] ?? 0), data.displayCurrency) }))}
          />
        </LineChart>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-[13px] text-nv-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[i] }} aria-hidden />{s.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ForecastHero: React.FC<{ data: ForecastData; onPickDay: (date: string) => void }> = ({ data, onPickDay }) => {
  const [mode, setMode] = useState<'total' | 'accounts'>('total');
  const { projection, scenario } = data;
  const low = lowestPoint(projection.days);
  const lows = useMemo(() => lowestPoints(projection.days, data.today), [projection.days, data.today]);
  const endDay = projection.days[projection.days.length - 1];
  const change = endDay ? endDay.total - projection.start : 0;
  const after = low ? nextIncomeAfter(projection.events, low.date) : undefined;
  const below = data.cushion !== undefined ? daysBelow(projection.days, data.cushion) : null;
  const scenarioDelta = scenario && endDay ? (scenario.days[scenario.days.length - 1]?.total ?? 0) - endDay.total : null;
  const cur = data.displayCurrency;
  const tone = low && low.value < 0 ? 'text-nv-red-text' : low && data.cushion !== undefined && low.value < data.cushion ? 'text-nv-orange-text' : undefined;

  return (
    <Card
      top={
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-nv-muted">Lowest balance ahead</p>
              <div className="mt-2">{low ? <Money amount={low.value} currency={cur} size="hero" className={tone} /> : <span className="text-3xl text-nv-muted">—</span>}</div>
              {low && (
                <p className="mt-2 text-sm text-nv-muted">
                  {low.date === projection.days[0]?.date ? 'today' : `on ${formatShortDate(low.date, data.today)}`}
                  {after && <>, {Math.max(0, daysFrom(parseLocalDate(low.date), after.date))} days before {after.description}</>}
                </p>
              )}
              <p className="mt-1 text-sm text-nv-muted">
                Today <Money amount={projection.start} currency={cur} className="text-sm" />
                {endDay && <> · {formatShortDate(endDay.date, data.today)} <Money amount={endDay.total} currency={cur} className="text-sm" /> · <Money amount={change} currency={cur} signed className="text-sm" /></>}
              </p>
              {scenarioDelta !== null && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-nv-sky-text">
                  <NvIcon name="sparkles" size={15} /> Scenario: <Money amount={scenarioDelta} currency={cur} signed className="text-sm" tone="inherit" /> by the end
                </p>
              )}
            </div>
            {data.selectedAccounts.length > 1 && (
              <SegmentedTabs<'total' | 'accounts'>
                label="Chart"
                size="sm"
                value={mode}
                onChange={setMode}
                items={[{ id: 'total', label: 'Total', icon: 'chartLine' }, { id: 'accounts', label: 'Per account', icon: 'layers' }]}
              />
            )}
          </div>
          {mode === 'accounts' && data.selectedAccounts.length > 1 ? <PerAccountChart data={data} onPickDay={onPickDay} /> : <TotalChart data={data} onPickDay={onPickDay} />}
          {below && below.count > 0 && (
            <button type="button" onClick={() => below.first && onPickDay(below.first)} className="flex min-h-11 items-center gap-2 text-left text-sm text-nv-ink">
              <NvIcon name="warning" size={16} className="text-nv-red-text" />
              Below <Money amount={data.cushion ?? 0} currency={cur} className="text-sm" /> on {below.count} {below.count === 1 ? 'day' : 'days'}, first on {formatShortDate(below.first ?? '', data.today)}
            </button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {lows.map(l => (
          <button key={l.label} type="button" onClick={() => onPickDay(l.date)} className="min-h-11 min-w-0 rounded-nv-sub text-left hover:bg-nv-surface/60">
            <span className="block text-[13px] text-nv-muted">{l.label}</span>
            <Money amount={l.value} currency={cur} size="lg" className={l.value < 0 ? 'text-nv-red-text' : undefined} />
            <span className="block text-xs text-nv-muted">{formatShortDate(l.date, data.today)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

const DRIVER_ICON: Record<Driver['kind'], NvIconName> = { recurring: 'repeat', bill: 'invoice', loan: 'bank', card: 'card', property: 'home', goal: 'award' };

/** What moves the line (N1, C5): the six largest flows over the horizon as bars; tap one to see it in the timeline. */
export const DriversCard: React.FC<{ data: ForecastData; onPick: (driver: Driver) => void }> = ({ data, onPick }) => {
  const list = useMemo(() => drivers(data.projection.events), [data.projection.events]);
  const max = Math.max(1, ...list.map(d => Math.abs(d.total)));
  return (
    <Card>
      <h2 className="mb-1 text-lg font-medium text-nv-ink">What moves the line</h2>
      <p className="mb-4 text-sm text-nv-muted">Until {formatShortDate(data.projection.days[data.projection.days.length - 1]?.date ?? '', data.today)}</p>
      {list.length === 0 ? <p className="text-sm text-nv-muted">Nothing planned for these accounts.</p> : (
        <ul className="space-y-1">
          {list.map(d => (
            <li key={d.key}>
              <button type="button" onClick={() => d.key !== 'other' && onPick(d)} className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-nv-sub px-2 py-1.5 text-left hover:bg-nv-surface/70">
                <span className="flex min-w-0 items-center gap-2 text-[15px] text-nv-ink">
                  <NvIcon name={DRIVER_ICON[d.kind]} size={16} className="shrink-0 text-nv-muted" />
                  <span className="truncate">{d.label}</span>
                  {d.count > 1 && <span className="shrink-0 text-[13px] text-nv-muted">× {d.count}</span>}
                </span>
                <Money amount={d.total} currency={data.displayCurrency} signed tone={d.total > 0 ? 'income' : 'ink'} />
                <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-nv-inset" aria-hidden>
                  <span className={cn('block h-full rounded-full', d.total > 0 ? 'bg-nv-green' : d.kind === 'goal' ? 'bg-nv-violet' : 'bg-nv-orange')} style={{ width: `${(Math.abs(d.total) / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/** The next five events with the balance after each. */
export const ComingUpCard: React.FC<{ data: ForecastData; onOpen: (e: ForecastEvent) => void; onShowAll: () => void }> = ({ data, onOpen, onShowAll }) => {
  const next = data.projection.events.filter(e => Math.abs(e.amount) >= 0.005).slice(0, 5);
  return (
    <Card>
      <h2 className="mb-3 text-lg font-medium text-nv-ink">Coming up</h2>
      {next.length === 0 ? <p className="text-sm text-nv-muted">Nothing planned for these accounts.</p> : (
        <ul>
          {next.map(e => (
            <li key={e.key}>
              <button type="button" onClick={() => onOpen(e)} className="flex min-h-14 w-full items-center gap-3 rounded-nv-sub px-2 text-left hover:bg-nv-surface/70">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-nv-ink">{e.description}</span>
                  <span className={cn('block text-[13px]', e.overdue ? 'text-nv-red-text' : 'text-nv-muted')}>{e.overdue ? `Overdue since ${formatShortDate(e.dueDate, data.today)}` : formatShortDate(e.date, data.today)}</span>
                </span>
                <span className="text-right">
                  <Money amount={e.amount} currency={data.displayCurrency} signed tone={e.amount > 0 ? 'income' : 'ink'} />
                  <span className="block text-xs text-nv-muted">then <Money amount={e.balanceAfter} currency={data.displayCurrency} className="text-xs" /></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onShowAll} className="mt-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-nv-violet-text">
        Open timeline <NvIcon name="arrowRight" size={16} />
      </button>
    </Card>
  );
};
