import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildBenchmark, type BenchmarkResult } from '../../utils/benchmark';
import type { Performance } from '../../utils/investmentMetrics';
import { BENCHMARK_PRESETS, choiceKey, fetchBenchmarkHistory, parseChoice, type BenchmarkChoice, type BenchmarkSeries } from '../../src/services/benchmarkService';
import { Amount } from '../ui/Money';
import { Button } from '../ui/Actions';
import { Banner, Spinner } from '../ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const MAX_PICKS = 3;
const STORE = 'crystal.benchmarks';
const COLORS = ['var(--amber)', 'var(--chart-positive)', 'var(--ink)'];
const pct = (v: number, digits = 1) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v * 100).toFixed(digits)}%`;

const loadPicks = (): BenchmarkChoice[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return (Array.isArray(raw) ? raw : []).map(parseChoice).filter((c): c is BenchmarkChoice => !!c).slice(0, MAX_PICKS);
  } catch { return []; }
};
const savePicks = (picks: BenchmarkChoice[]) => { try { localStorage.setItem(STORE, JSON.stringify(picks.map(choiceKey))); } catch { /* optional */ } };

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; series: BenchmarkSeries };

const W = 640, H = 240, PAD = { top: 12, right: 12, bottom: 28, left: 56 };
const innerW = W - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom;
const compact = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** The money you put in, what each index would have made of it, and your own holdings' worth today. */
const GrowthChart: React.FC<{ lines: { key: string; label: string; color: string; points: BenchmarkResult['points'] }[]; yourValue: number; currency: string; hideValues: boolean }> = ({ lines, yourValue, currency, hideValues }) => {
  const base = lines[0].points;
  const t0 = new Date(`${base[0].date}T00:00:00`).getTime();
  const t1 = Math.max(...lines.map(l => new Date(`${l.points[l.points.length - 1].date}T00:00:00`).getTime()));
  const max = Math.max(1, yourValue, ...lines.flatMap(l => l.points.map(p => Math.max(p.index, p.invested)))) * 1.05;
  const x = (date: string) => PAD.left + ((new Date(`${date}T00:00:00`).getTime() - t0) / Math.max(1, t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;
  const path = (pts: { date: string; v: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map(f => new Date(t0 + f * (t1 - t0)).toISOString().slice(0, 10));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="What each index would have made of the same money, against the money you put in and what your holdings are worth now.">
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(f * max)} y2={y(f * max)} className="stroke-line" strokeWidth={1} />
          {!hideValues && <text x={PAD.left - 8} y={y(f * max) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{compact(f * max, currency)}</text>}
        </g>
      ))}
      {ticks.map((t, i) => <text key={t} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-muted" fontSize={11}>{monthLabel(t)}</text>)}
      <path d={path(base.map(p => ({ date: p.date, v: p.invested })))} fill="none" className="stroke-muted" strokeWidth={1.5} strokeDasharray="4 4" />
      {lines.map(l => <path key={l.key} d={path(l.points.map(p => ({ date: p.date, v: p.index })))} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" />)}
      {yourValue > 0 && <circle cx={x(base[base.length - 1].date)} cy={y(yourValue)} r={6} fill="var(--surface)" stroke="var(--primary)" strokeWidth={3}><title>Your holdings today</title></circle>}
    </svg>
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
                <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-primary" />Your holdings today</span>
                {results.map(r => <span key={choiceKey(r.choice)} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: r.color }} />{r.choice.label}</span>)}
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
