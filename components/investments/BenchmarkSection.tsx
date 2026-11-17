import React, { useEffect, useMemo, useRef, useState } from 'react';
import { curveNatural } from '@visx/curve';
import { buildBenchmark, type BenchmarkResult } from '../../utils/benchmark';
import type { Currency } from '../../types';
import type { Performance } from '../../utils/investmentMetrics';
import { BENCHMARK_PRESETS, choiceKey, fetchBenchmarkHistory, parseChoice, type BenchmarkChoice, type BenchmarkSeries } from '../../src/services/benchmarkService';
import { formatCurrency, parseLocalDate } from '../../utils';
import { ChartTooltip, Grid, Line, LineChart, LineSeriesTerminalMarker, ProjectionLine, XAxis, YAxis } from '../../src/components/charts';
import { useChartStable, useYScale } from '../../src/components/charts/chart-context';
import { SpotlightIndicator } from '../../src/components/charts/spotlight-indicator';
import { HorizonArea } from '../ForecastHorizonChart';
import { spanTick } from './PortfolioHero';
import { Amount } from '../ui/Money';
import { Button } from '../ui/Actions';
import { Banner, Spinner } from '../ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const MAX_PICKS = 3;
const STORE = 'crystal.benchmarks';
const COLORS = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)'];
const pct = (v: number, digits = 1) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v * 100).toFixed(digits)}%`;

const loadPicks = (): BenchmarkChoice[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return (Array.isArray(raw) ? raw : []).map(parseChoice).filter((c): c is BenchmarkChoice => !!c).slice(0, MAX_PICKS);
  } catch { return []; }
};
const savePicks = (picks: BenchmarkChoice[]) => { try { localStorage.setItem(STORE, JSON.stringify(picks.map(choiceKey))); } catch { /* optional */ } };

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; series: BenchmarkSeries };

const compact = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Terminal ring showing what your own holdings are worth today, rendered on top of the series layers. */
const YourHoldingsMarker: React.FC<{ yourValue: number }> = ({ yourValue }) => {
  const { innerWidth } = useChartStable();
  const yScale = useYScale();
  const cy = yScale(yourValue);
  if (!Number.isFinite(cy) || innerWidth <= 0) return null;
  return (
    <g pointerEvents="none">
      <circle cx={innerWidth} cy={cy} r={5.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2.5} />
    </g>
  );
};
(YourHoldingsMarker as React.FC<{ yourValue: number }> & { __isPostOverlay?: boolean }).__isPostOverlay = true;

/** The money you put in, what each index would have made of it, and your own holdings' worth today. */
const GrowthChart: React.FC<{ lines: { key: string; label: string; color: string; points: BenchmarkResult['points'] }[]; yourValue: number; currency: string; hideValues: boolean }> = ({ lines, yourValue, currency, hideValues }) => {
  const chartData = useMemo(() => {
    if (lines.length === 0) return [];
    const dateSet = new Set<string>();
    lines.forEach(l => l.points.forEach(p => dateSet.add(p.date)));
    const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    const cursors = lines.map(() => 0);

    return sortedDates.map(isoDate => {
      const row: Record<string, unknown> = {
        date: parseLocalDate(isoDate),
        invested: 0,
      };
      let investedSet = false;
      lines.forEach((line, idx) => {
        const pts = line.points;
        if (pts.length === 0) return;
        while (cursors[idx] + 1 < pts.length && pts[cursors[idx] + 1].date <= isoDate) {
          cursors[idx] += 1;
        }
        const matched = pts[cursors[idx]];
        row[line.key] = matched.index;
        if (!investedSet) {
          row.invested = matched.invested;
          investedSet = true;
        }
      });
      return row;
    });
  }, [lines]);

  const tick = useMemo(() => spanTick(chartData as { date: Date }[]), [chartData]);
  const primary = lines[0];
  if (!primary || chartData.length < 2) return null;

  const firstDate = chartData[0].date as Date;
  const lastDate = chartData[chartData.length - 1].date as Date;
  const currencyTyped = currency as Currency;

  return (
    <div aria-label="What each index would have made of the same money, against the money you put in and what your holdings are worth now." role="region">
      <LineChart
        data={chartData}
        xDataKey="date"
        revealSignature={`${lines.map(l => l.key).join('-')}-${chartData.length}`}
        yDomainTween
        aspectRatio=""
        className="h-[240px] w-full md:h-[260px]"
        margin={{ top: 16, right: 16, bottom: 28, left: hideValues ? 16 : 56 }}
      >
        <Grid horizontal numTicksRows={4} stroke="var(--line)" />
        <SpotlightIndicator seriesKey={primary.key} color={primary.color} />
        <HorizonArea seriesKey={primary.key} color={primary.color} curve={curveNatural} />
        <XAxis numTicks={5} tickMode="domain" tickFormatter={tick} />
        {!hideValues && <YAxis numTicks={4} tickFormatter={v => compact(v, currency)} />}
        <Line dataKey="invested" label="Money put in" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5,5" curve={curveNatural} fadeEdges={false} />
        {lines.map(l => (
          <Line key={l.key} dataKey={l.key} label={l.label} stroke={l.color} strokeWidth={2.25} curve={curveNatural} fadeEdges={false} />
        ))}
        <LineSeriesTerminalMarker dataKey={primary.key} stroke={primary.color} fill={primary.color} />
        {yourValue > 0 && (
          <ProjectionLine
            data={[{ date: firstDate, value: yourValue }, { date: lastDate, value: yourValue }]}
            stroke="var(--primary)"
            strokeOpacity={0.35}
            strokeDasharray="3,4"
            strokeWidth={1.25}
            showEndMarker={false}
          />
        )}
        {yourValue > 0 && <YourHoldingsMarker yourValue={yourValue} />}
        <ChartTooltip
          showCrosshair
          rows={point => [
            ...lines.map(l => ({
              color: l.color,
              label: l.label,
              value: hideValues ? '•••' : formatCurrency(Number(point[l.key] ?? 0), currencyTyped),
            })),
            {
              color: 'var(--muted)',
              label: 'Money put in',
              value: hideValues ? '•••' : formatCurrency(Number(point.invested ?? 0), currencyTyped),
            },
            ...(yourValue > 0
              ? [{
                  color: 'var(--primary)',
                  label: 'Your holdings today',
                  value: hideValues ? '•••' : formatCurrency(yourValue, currencyTyped),
                }]
              : []),
          ]}
        />
      </LineChart>
    </div>
  );
};

const BenchmarkSection: React.FC<{ performance: Performance; currency: string; apiKey?: string; hideValues?: boolean }> = ({ performance, currency, apiKey, hideValues = false }) => {
  const [picks, setPicks] = useState<BenchmarkChoice[]>(loadPicks);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState('');
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const { portfolio } = performance;
  const from = useMemo(() => portfolio.flows.map(f => f.date).sort()[0], [portfolio.flows]);
  const keys = picks.map(choiceKey).join(',');
  // What has already been asked for with this key and start date, so adding a second index does not refetch the first.
  const asked = useRef<{ scope: string; keys: Set<string> }>({ scope: '', keys: new Set() });

  useEffect(() => {
    if (!apiKey || !from) return;
    const scope = `${apiKey}|${from}`;
    if (asked.current.scope !== scope) asked.current = { scope, keys: new Set() };
    picks.forEach(choice => {
      const key = choiceKey(choice);
      if (asked.current.keys.has(key)) return;
      asked.current.keys.add(key);
      setLoaded(prev => ({ ...prev, [key]: { status: 'loading' } }));
      fetchBenchmarkHistory(choice, from, apiKey)
        .then(series => setLoaded(prev => ({ ...prev, [key]: { status: 'ready', series } })))
        .catch(error => { setLoaded(prev => ({ ...prev, [key]: { status: 'error', message: error instanceof Error ? error.message : 'Could not load prices.' } })); asked.current.keys.delete(key); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, apiKey, from]);

  const update = (next: BenchmarkChoice[]) => { setPicks(next); savePicks(next); };
  const toggle = (choice: BenchmarkChoice) => update(picks.some(p => choiceKey(p) === choiceKey(choice)) ? picks.filter(p => choiceKey(p) !== choiceKey(choice)) : [...picks, choice].slice(-MAX_PICKS));
  const addCustom = () => {
    const choice = parseChoice(custom);
    if (!choice) { setCustomError('Use a ticker like SPY, or ticker:exchange like VWCE:XETR.'); return; }
    setCustomError(''); setCustom(''); if (!picks.some(p => choiceKey(p) === choiceKey(choice))) update([...picks, choice].slice(-MAX_PICKS));
  };

  const results = picks.map((choice, i) => {
    const state = loaded[choiceKey(choice)];
    const result = state?.status === 'ready' ? buildBenchmark({ flows: portfolio.flows, series: state.series.points, yourValue: portfolio.value, yourXirr: portfolio.xirr }) : null;
    return { choice, state, result, color: COLORS[i % COLORS.length], seriesCurrency: state?.status === 'ready' ? state.series.currency : undefined };
  });
  const drawn = results.filter(r => r.result).map(r => ({ key: choiceKey(r.choice), label: r.choice.label, color: r.color, points: r.result!.points }));

  return (
    <section className={CARD} aria-label="Against an index">
      <h2 className="type-card-title text-ink">Against an index</h2>
      <p className="type-caption mt-1 text-muted">The same buys and sales, on the same days, put into an index fund instead. Pick up to {MAX_PICKS}.</p>

      {!apiKey ? (
        <Banner tone="info" className="mt-3">Index prices come from Twelve Data. Add your key under Integrations to compare.</Banner>
      ) : portfolio.flows.length === 0 ? (
        <p className="type-body mt-3 text-muted">Needs at least one priced holding with a buy.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {BENCHMARK_PRESETS.map(choice => {
              const on = picks.some(p => choiceKey(p) === choiceKey(choice));
              return <Button key={choiceKey(choice)} size="sm" variant={on ? 'soft' : 'secondary'} aria-pressed={on} onPress={() => toggle(choice)}>{choice.label}</Button>;
            })}
            {picks.filter(p => !BENCHMARK_PRESETS.some(b => choiceKey(b) === choiceKey(p))).map(choice => <Button key={choiceKey(choice)} size="sm" variant="soft" aria-pressed onPress={() => toggle(choice)}>{choice.label} ✕</Button>)}
          </div>
          <form className="mt-3 flex items-start gap-2" onSubmit={e => { e.preventDefault(); addCustom(); }}>
            <div className="min-w-0 flex-1">
              <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Any ticker, e.g. CSPX:XLON" aria-label="Another ticker to compare against" className="type-body h-10 w-full rounded-[var(--radius-lg)] border border-line-strong bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus)]" />
              {customError && <p className="type-caption mt-1 text-money-out">{customError}</p>}
            </div>
            <Button size="md" variant="secondary" type="submit">Add</Button>
          </form>

          {picks.length === 0 ? (
            <p className="type-body mt-4 text-muted">Choose an index above to see how it would have done.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {drawn.length > 0 && <GrowthChart lines={drawn} yourValue={portfolio.value} currency={currency} hideValues={hideValues} />}
              <div className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-muted">
                <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted" />Money put in</span>
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-primary bg-surface" />Your holdings today</span>
                {results.map(r => <span key={choiceKey(r.choice)} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-full" style={{ background: r.color }} />{r.choice.label}</span>)}
              </div>
              <ul className="divide-y divide-line">
                {results.map(({ choice, state, result, seriesCurrency }) => (
                  <li key={choiceKey(choice)} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="type-body-strong text-ink">{choice.label}</span>
                      {!state || state.status === 'loading' ? <span className="type-caption flex items-center gap-1.5 text-muted"><Spinner className="size-4" />Loading prices</span>
                        : state.status === 'error' ? <span className="type-caption text-money-out">{state.message}</span>
                        : !result ? <span className="type-caption text-muted">No prices for your dates.</span>
                        : <span className="type-body text-ink">
                            {result.lead === null ? 'Index would be worth ' : result.lead >= 0 ? 'You are ahead by ' : 'You are behind by '}
                            {result.lead === null ? <Amount value={result.indexValue} currency={currency} className="type-body" /> : <Amount value={Math.abs(result.lead)} currency={currency} className="type-body" />}
                            {result.leadPerYear !== null && <span className="type-caption ml-1.5 text-muted">{pct(result.leadPerYear)} a year</span>}
                          </span>}
                    </div>
                    {result && (
                      <p className="type-caption mt-1 text-muted">
                        Index: <Amount value={result.indexValue} currency={currency} className="type-caption" /> now{result.indexXirr !== null && `, ${pct(result.indexXirr)} a year`}. You: <Amount value={portfolio.value} currency={currency} className="type-caption" />{portfolio.xirr !== null && `, ${pct(portfolio.xirr)} a year`}. Prices to {result.asOf}.
                        {seriesCurrency && seriesCurrency !== currency && ` Quoted in ${seriesCurrency}, so currency moves are included. A fund listed in ${currency} compares more fairly.`}
                        {result.startsBeforeData && ' Some of your money went in before this fund has price history, so those buys use its first price.'}
                        {result.shortfall && ' Your sales were larger than the index would have held, so its result is understated.'}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="type-caption text-muted">Only holdings with a live price are counted, as in the return above. Your amounts use today's exchange rates, and the fund's own dividends are included only if its price is adjusted for them.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default BenchmarkSection;
