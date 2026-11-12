import React from 'react';
import type { Performance } from '../../utils/investmentMetrics';
import { MIN_RELIABLE_DAYS } from '../../utils/investmentMetrics';
import { Amount } from '../ui/Money';
import { EmptyState } from '../ui/States';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const pct = (v: number, digits = 1) => `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(digits)}%`;
const span = (days: number) => days >= 730 ? `${(days / 365).toFixed(1)} years` : days >= 60 ? `${Math.round(days / 30)} months` : `${days} days`;

const LEVEL_TEXT: Record<Performance['concentration']['level'], string> = {
  balanced: 'Spread out: no single holding dominates.',
  concentrated: 'Fairly concentrated: a few holdings carry most of the value.',
  'very concentrated': 'Very concentrated: more than half of the value is in one holding.',
  single: 'Everything is in one holding.',
};

/** Returns, contributions against growth, and concentration, from what you bought, sold and hold. */
const PerformancePanel: React.FC<{ performance: Performance; currency: string; onOpenHolding: (symbol: string) => void }> = ({ performance, currency, onOpenHolding }) => {
  const { portfolio, contributions, concentration, holdings } = performance;
  if (holdings.length === 0) return <EmptyState icon="chart-line-data-01" title="No trades to measure yet" description="Add buys and sales, and Crystal will work out what your investments earned each year." />;
  const growthShare = contributions.growthShare;
  const ownShare = growthShare === null ? null : Math.max(0, Math.min(1, 1 - Math.max(0, growthShare)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className={CARD}>
          <h2 className="type-label text-muted">Return per year</h2>
          <p className="type-figure-lg mt-1 text-ink">{portfolio.xirr === null ? 'Not enough yet' : pct(portfolio.xirr)}</p>
          <p className="type-caption mt-1 text-muted">
            {portfolio.xirr === null
              ? (portfolio.excluded > 0 && portfolio.invested === 0 ? 'None of your holdings has a live price yet.' : 'Needs at least one buy and some value today.')
              : portfolio.reliable
                ? `Money-weighted, over ${span(portfolio.days)} of trading. It counts when each amount went in.`
                : `Only ${span(portfolio.days)} of history, so a yearly rate would mislead. Treat it as a rough guide.`}
            {portfolio.excluded > 0 && ` ${portfolio.excluded} ${portfolio.excluded === 1 ? 'holding is' : 'holdings are'} left out for want of a price.`}
          </p>
        </section>
        <section className={CARD}>
          <h2 className="type-label text-muted">Total gain</h2>
          <p className="type-figure-lg mt-1 text-ink"><Amount value={portfolio.gain} currency={currency} tone="flow" /></p>
          <p className="type-caption mt-1 text-muted">{portfolio.gainPct === null ? (portfolio.excluded > 0 ? 'Waiting for prices.' : 'Nothing bought yet.') : `${pct(portfolio.gainPct)} on `}{portfolio.gainPct !== null && <><Amount value={portfolio.invested} currency={currency} className="type-caption" /> bought. Sales and what you still hold, together.</>}</p>
        </section>
        <section className={CARD}>
          <h2 className="type-label text-muted">Your money and its growth</h2>
          <p className="type-figure-lg mt-1 text-ink"><Amount value={contributions.net} currency={currency} /></p>
          <p className="type-caption mt-1 text-muted">put in, net of what you took out. It grew by <Amount value={contributions.growth} currency={currency} tone="flow" className="type-caption" /> to <Amount value={contributions.value} currency={currency} className="type-caption" />.</p>
          {ownShare !== null && (
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-inset" role="img" aria-label={`${Math.round(ownShare * 100)}% your money, ${Math.round((1 - ownShare) * 100)}% growth`}>
              <span className="bg-primary" style={{ width: `${ownShare * 100}%` }} />
              <span className={contributions.growth >= 0 ? 'bg-money-in' : 'bg-money-out'} style={{ width: `${(1 - ownShare) * 100}%` }} />
            </div>
          )}
        </section>
      </div>

      <section className={CARD} aria-label="Return by holding">
        <h2 className="type-card-title mb-3 text-ink">By holding</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="type-label text-muted">
                <th className="py-2 pr-3 font-semibold">Holding</th>
                <th className="py-2 pr-3 text-right font-semibold">Bought</th>
                <th className="py-2 pr-3 text-right font-semibold">Worth now</th>
                <th className="py-2 pr-3 text-right font-semibold">Gain</th>
                <th className="py-2 text-right font-semibold">Per year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {holdings.map(row => (
                <tr key={row.symbol} className="group">
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => onOpenHolding(row.symbol)} className="type-body-strong cursor-pointer text-left text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-[var(--focus)]">{row.symbol}</button>
                    <span className="type-caption ml-2 text-muted">{row.open ? row.name : 'sold'}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right"><Amount value={row.invested} currency={currency} className="type-body text-ink" /></td>
                  <td className="py-2.5 pr-3 text-right"><Amount value={row.value} currency={currency} className="type-body text-ink" /></td>
                  <td className="py-2.5 pr-3 text-right">
                    <Amount value={row.gain} currency={currency} tone="flow" className="type-body text-ink" />
                    {row.gainPct !== null && <span className="type-caption ml-1.5 text-muted">{pct(row.gainPct, 0)}</span>}
                  </td>
                  <td className="py-2.5 text-right type-body text-ink" title={!row.priced ? 'No live price, so no return is worked out.' : !row.reliable && row.xirr !== null ? `Under ${MIN_RELIABLE_DAYS} days of history.` : undefined}>
                    {!row.priced ? <span className="text-muted">no price</span> : row.xirr === null ? <span className="text-muted">n/a</span> : row.reliable ? pct(row.xirr) : <span className="text-muted">{pct(row.xirr, 0)}*</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="type-caption mt-3 text-muted">* Under {MIN_RELIABLE_DAYS} days of history, so the yearly rate is only a rough guide. Amounts use today's exchange rates, and prices are the ones you or the quote service last set.</p>
      </section>

      <section className={CARD} aria-label="Concentration">
        <h2 className="type-card-title mb-1 text-ink">How spread out it is</h2>
        {concentration.top ? (
          <>
            <p className="type-body text-ink">{LEVEL_TEXT[concentration.level]}</p>
            <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div><dt className="type-caption text-muted">Largest holding</dt><dd className="type-figure-md text-ink">{pct(concentration.top.share, 0)}</dd><p className="type-caption text-muted">{concentration.top.symbol}</p></div>
              <div><dt className="type-caption text-muted">Top three together</dt><dd className="type-figure-md text-ink">{pct(concentration.top3Share, 0)}</dd></div>
              <div><dt className="type-caption text-muted">Works like</dt><dd className="type-figure-md text-ink">{concentration.effectiveHoldings.toFixed(1)}</dd><p className="type-caption text-muted">equal holdings</p></div>
            </dl>
            <h3 className="type-label mt-4 mb-2 text-muted">By currency</h3>
            <ul className="space-y-2">
              {concentration.currencies.map(c => (
                <li key={c.currency} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3">
                  <span className="type-body text-ink">{c.currency}</span>
                  <span className="block h-2 overflow-hidden rounded-full bg-inset" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${c.share * 100}%` }} /></span>
                  <span className="type-caption text-right text-muted">{pct(c.share, 0)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="type-body text-muted">Nothing held right now.</p>}
      </section>
    </div>
  );
};

export default PerformancePanel;
