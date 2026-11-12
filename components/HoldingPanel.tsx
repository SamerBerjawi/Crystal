import React, { useMemo, useState } from 'react';
import type { Account, HoldingSummary, InvestmentTransaction, PriceHistoryEntry, Warrant } from '../types';
import { convertCurrency, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { CANDLE_MIN_POINTS, formatHoldingType } from '../utils/investments';
import { curveMonotoneX } from '@visx/curve';
import { ChartMarkers, ChartTooltip, Grid, Line, LineChart, LineSeriesTerminalMarker, XAxis, YAxis, type ChartMarker } from '../src/components/charts';
import { SpotlightIndicator } from '../src/components/charts/spotlight-indicator';
import { priceRange } from '../utils/portfolioInsights';
import { HorizonArea } from './ForecastHorizonChart';
import { fitTick, spanTick } from './investments/PortfolioHero';
import { Legend, ShareBar } from './accounts/charts';
import InvestmentCandlestickChart from './InvestmentCandlestickChart';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu } from './ui/Menu';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';

const CHART_MODES = [{ id: 'line', label: 'Line' }, { id: 'candle', label: 'Candles' }];
const PRICE_RANGES = [{ id: '91', label: '3M' }, { id: '365', label: '1Y' }, { id: 'all', label: 'All' }];
const DAY_MS = 86_400_000;
const fullDate = (date: string) => parseLocalDate(date.slice(0, 10)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

interface HoldingPanelProps {
  holding: HoldingSummary;
  account?: Account;
  trades: InvestmentTransaction[];
  grants: Warrant[];
  priceLog: PriceHistoryEntry[];
  onClose: () => void;
  onLogPrice: (entry?: PriceHistoryEntry) => void;
  onDeletePrice: (date: string) => void;
  onTrade: () => void;
  onEditTrade: (trade: InvestmentTransaction) => void;
  onEditGrant: (grant: Warrant) => void;
  /** Share of the portfolio, in percent. */
  weight?: number;
}

/** A holding beside the portfolio (D-025): what it's worth, how it got there, and its logged prices. */
const HoldingPanel: React.FC<HoldingPanelProps> = ({ holding, account, trades, grants, priceLog, onClose, onLogPrice, onDeletePrice, onTrade, onEditTrade, onEditGrant, weight }) => {
  const [priceRangeId, setPriceRangeId] = useState('all');
  const [chartMode, setChartMode] = useState('line');
  const [priceLogShown, setPriceLogShown] = useState(12);
  const currency = holding.currency ?? 'EUR';
  const canShowCandles = priceLog.length >= CANDLE_MIN_POINTS;
  const gain = holding.priceUnavailable ? null : holding.currentValue - holding.totalCost;
  const gainPct = gain !== null && holding.totalCost > 0 ? (gain / holding.totalCost) * 100 : null;
  const averageCost = holding.quantity > 0 ? holding.totalCost / holding.quantity : 0;
  const nativeAverageCost = holding.quantity > 0 ? convertCurrency(averageCost, getMainCurrency(), currency) : 0;
  const lastLogged = priceLog[priceLog.length - 1];
  const windowLog = useMemo(() => {
    if (priceRangeId === 'all') return priceLog;
    const since = Date.now() - Number(priceRangeId) * DAY_MS;
    const recent = priceLog.filter(entry => parseLocalDate(entry.date.slice(0, 10)).getTime() >= since);
    return recent.length > 1 ? recent : priceLog.slice(-2);
  }, [priceLog, priceRangeId]);
  const chartData = useMemo(() => windowLog.map(entry => ({ date: parseLocalDate(entry.date.slice(0, 10)), value: entry.price, ...(holding.quantity > 0 && nativeAverageCost > 0 ? { cost: nativeAverageCost } : {}) })), [windowLog, holding.quantity, nativeAverageCost]);
  const tick = useMemo(() => spanTick(chartData), [chartData]);
  const range = useMemo(() => priceRange(windowLog, holding.currentPrice), [windowLog, holding.currentPrice]);
  const markers = useMemo<ChartMarker[]>(() => {
    if (windowLog.length < 2) return [];
    const start = parseLocalDate(windowLog[0].date.slice(0, 10)).getTime();
    const end = parseLocalDate(windowLog[windowLog.length - 1].date.slice(0, 10)).getTime();
    return [
      ...trades.map(trade => ({ trade, buy: trade.type?.toLowerCase() === 'buy' })).map(({ trade, buy }) => ({
        date: parseLocalDate(trade.date.slice(0, 10)),
        title: `${buy ? 'Bought' : 'Sold'} ${trade.quantity.toLocaleString()}`,
        description: `at ${formatCurrency(trade.price, trade.currency ?? currency)}, ${fullDate(trade.date)}`,
        color: buy ? 'var(--money-in)' : 'var(--amber)',
        onClick: () => onEditTrade(trade),
      })),
      ...grants.map(grant => ({
        date: parseLocalDate(grant.grantDate.slice(0, 10)),
        title: `Granted ${grant.quantity.toLocaleString()}`,
        description: fullDate(grant.grantDate),
        color: 'var(--blue)',
        onClick: () => onEditGrant(grant),
      })),
    ].filter(marker => marker.date.getTime() >= start && marker.date.getTime() <= end);
  }, [windowLog, trades, grants, currency, onEditTrade, onEditGrant]);
  const rising = windowLog.length > 1 && windowLog[windowLog.length - 1].price >= windowLog[0].price;
  const lineColor = rising ? 'var(--money-in)' : 'var(--money-out)';
  const holdingSince = useMemo(() => {
    const dates = [...trades.map(trade => trade.date), ...grants.map(grant => grant.grantDate)].filter(Boolean).sort();
    return dates[0];
  }, [trades, grants]);

  const activity = useMemo(() => [
    ...trades.map(trade => ({ id: trade.id, date: trade.date, label: trade.type?.toLowerCase() === 'buy' ? 'Buy' : 'Sell', quantity: trade.quantity, price: trade.price, tradeCurrency: trade.currency ?? currency, onEdit: () => onEditTrade(trade) })),
    ...grants.map(grant => ({ id: grant.id, date: grant.grantDate, label: 'Grant', quantity: grant.quantity, price: grant.grantPrice, tradeCurrency: currency, onEdit: () => onEditGrant(grant) })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)), [trades, grants, currency, onEditTrade, onEditGrant]);

  const descendingLog = useMemo(() => [...priceLog].reverse(), [priceLog]);

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      width={640}
      title={holding.name || holding.symbol}
      description={[holding.symbol, holding.type === 'Warrant' ? 'Warrant' : formatHoldingType(account?.subType || holding.subType), account?.financialInstitution].filter(Boolean).join(', ')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onPress={() => onLogPrice()}>Log a price</Button>
          <Button onPress={onTrade}>Trade</Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] border border-line/60 bg-surface/40 p-4">
        <div>
          <dt className="type-label text-muted">Value</dt>
          <dd className="type-figure-lg mt-0.5 text-ink"><Amount value={holding.currentValue} currency={getMainCurrency()} /></dd>
        </div>
        <div>
          <dt className="type-label text-muted">Total return</dt>
          <dd className="type-figure-lg mt-0.5 text-ink">
            {gain === null ? (
              <span className="type-body text-muted">No price yet</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className={gain >= 0 ? 'text-money-in' : 'text-money-out'}><Amount value={gain} currency={getMainCurrency()} tone="flow" /></span>
                {gainPct !== null && <Badge tone={gain >= 0 ? 'positive' : 'negative'}>{gainPct >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)}%</Badge>}
              </span>
            )}
          </dd>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div><dt className="type-label text-muted">Average cost</dt><dd className="type-figure-row text-ink"><Amount value={averageCost} currency={getMainCurrency()} /></dd></div>
        <div>
          <dt className="type-label text-muted">Market price</dt>
          <dd className="type-figure-row text-ink"><Amount value={holding.currentPrice} currency={currency} /></dd>
          {lastLogged && <dd className="type-caption text-muted">Logged {fullDate(lastLogged.date)}</dd>}
        </div>
        <div><dt className="type-label text-muted">Units</dt><dd className="type-figure-row text-ink">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</dd></div>
        <div><dt className="type-label text-muted">Cost</dt><dd className="type-figure-row text-ink"><Amount value={holding.totalCost} currency={getMainCurrency()} /></dd></div>
        {weight !== undefined && (
          <div>
            <dt className="type-label text-muted">Share of portfolio</dt>
            <dd className="type-figure-row text-ink">{weight.toFixed(1)}%</dd>
            <dd className="mt-1 w-28"><ShareBar value={weight} label="Share of portfolio" /></dd>
          </div>
        )}
        {holdingSince && <div><dt className="type-label text-muted">Held since</dt><dd className="type-figure-row text-ink">{fullDate(holdingSince)}</dd></div>}
      </dl>

      <section aria-label="Price" className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="type-card-title text-ink">Price</h3>
          <div className="flex flex-wrap gap-2">
            {chartMode === 'line' && priceLog.length > 2 && <SegmentedControl items={PRICE_RANGES} activeId={priceRangeId} onChange={setPriceRangeId} />}
            {canShowCandles && <SegmentedControl items={CHART_MODES} activeId={chartMode} onChange={setChartMode} />}
          </div>
        </div>
        {priceLog.length < 2 ? (
          <p className="type-body text-muted">Log at least two prices to see a chart.</p>
        ) : chartMode === 'candle' && canShowCandles ? (
          <>
            <InvestmentCandlestickChart currentValue={holding.currentPrice} costBasis={holding.quantity > 0 ? nativeAverageCost : undefined} priceHistory={priceLog} currency={currency} />
            <p className="type-caption mt-1 text-muted">Candles come from the prices logged in each period, not from market trading data.</p>
          </>
        ) : (
          <>
            <LineChart data={chartData} xDataKey="date" revealSignature={`${priceRangeId}-${chartData.length}`} yDomainTween fitYDomain aspectRatio="" className="h-[240px] w-full" margin={{ top: 16, right: 12, bottom: 24, left: 48 }}>
              <Grid horizontal numTicksRows={4} stroke="var(--line)" />
              <SpotlightIndicator seriesKey="value" color={lineColor} />
              <HorizonArea seriesKey="value" color={lineColor} curve={curveMonotoneX} />
              <XAxis numTicks={4} tickMode="domain" tickFormatter={tick} />
              <YAxis numTicks={4} tickFormatter={fitTick} />
              {'cost' in (chartData[0] ?? {}) && <Line dataKey="cost" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5,5" fadeEdges={false} />}
              <Line dataKey="value" stroke={lineColor} strokeWidth={2.25} curve={curveMonotoneX} fadeEdges={false} />
              <LineSeriesTerminalMarker dataKey="value" stroke={lineColor} fill={lineColor} />
              {markers.length > 0 && <ChartMarkers items={markers} size={20} />}
              <ChartTooltip
                rows={point => [
                  { color: lineColor, label: 'Price', value: formatCurrency(Number(point.value) || 0, currency) },
                  ...(typeof point.cost === 'number' ? [{ color: 'var(--muted)', label: 'Your average cost', value: formatCurrency(point.cost, currency) }] : []),
                ]}
              />
            </LineChart>
            <Legend
              className="mt-2"
              items={[
                { label: 'Price', color: lineColor },
                ...('cost' in (chartData[0] ?? {}) ? [{ label: 'Average cost', color: 'var(--muted)', dashed: true }] : []),
                ...(markers.length ? [{ label: 'Trades', color: 'var(--amber)', dashed: true }] : []),
              ]}
            />
          </>
        )}
        {range && (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-line/60 bg-inset/50 p-3">
            <div className="type-caption flex justify-between text-muted">
              <span>Low <span className="tabular-nums font-medium text-ink"><Amount value={range.low} currency={currency} /></span></span>
              <span>High <span className="tabular-nums font-medium text-ink"><Amount value={range.high} currency={currency} /></span></span>
            </div>
            <div className="relative mt-2.5 h-1.5 rounded-full bg-line-strong overflow-visible">
              <div className="h-full rounded-full bg-primary/40" style={{ width: `${Math.min(100, Math.max(0, range.position))}%` }} />
              <span
                aria-hidden="true"
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow-sm transition-transform hover:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, range.position))}%` }}
              />
            </div>
            <p className="type-caption mt-2 text-muted">Now {Math.round(range.position)}% of the way from the low to the high in this range.</p>
          </div>
        )}
      </section>

      <section aria-label="Activity" className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="type-card-title text-ink">Activity</h3>
            {activity.length > 0 && <span className="type-caption text-muted">({activity.length})</span>}
          </div>
          <Button variant="ghost" size="sm" icon="add-01" onPress={onTrade}>Add trade</Button>
        </div>
        {activity.length === 0 ? <p className="type-body mt-1 text-muted">No trades yet.</p> : (
          <ul className="mt-1 divide-y divide-line">
            {activity.map(item => (
              <li key={item.id} className="flex min-h-12 items-center gap-2 py-1">
                <Badge tone={item.label === 'Sell' ? 'attention' : item.label === 'Grant' ? 'neutral' : 'positive'}>{item.label}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="type-body block truncate text-ink">{item.quantity.toLocaleString()} at <Amount value={item.price} currency={item.tradeCurrency} /></span>
                  <span className="type-caption block text-muted">{fullDate(item.date)}</span>
                </span>
                <span className="type-figure-row shrink-0 text-ink"><Amount value={item.quantity * item.price} currency={item.tradeCurrency} /></span>
                <IconButton icon="pencil-edit-02" label={`Edit ${item.label.toLowerCase()} from ${fullDate(item.date)}`} tooltipPlacement="left" onPress={item.onEdit} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Price log" className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="type-card-title text-ink">Price log</h3>
            {descendingLog.length > 0 && <span className="type-caption text-muted">({descendingLog.length})</span>}
          </div>
          <Button variant="ghost" size="sm" icon="add-01" onPress={() => onLogPrice()}>Log price</Button>
        </div>
        {descendingLog.length === 0 ? <p className="type-body mt-1 text-muted">No prices logged yet.</p> : (
          <>
            <ul className="mt-1 divide-y divide-line">
              {descendingLog.slice(0, priceLogShown).map(entry => (
                <li key={entry.date} className="flex min-h-11 items-center gap-2">
                  <span className="type-body min-w-0 flex-1 text-ink">{fullDate(entry.date)}</span>
                  <span className="type-figure-row shrink-0 text-ink"><Amount value={entry.price} currency={currency} /></span>
                  <Menu
                    title={fullDate(entry.date)}
                    trigger={<IconButton icon="more-horizontal" label={`Actions for ${fullDate(entry.date)}`} tooltipPlacement="left" />}
                    items={[
                      { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => onLogPrice(entry) },
                      { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => onDeletePrice(entry.date) },
                    ]}
                  />
                </li>
              ))}
            </ul>
            {descendingLog.length > 12 && (
              <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2">
                <span className="type-caption text-muted">
                  Showing {Math.min(priceLogShown, descendingLog.length)} of {descendingLog.length}
                </span>
                <div className="flex gap-2">
                  {priceLogShown < descendingLog.length ? (
                    <Button variant="ghost" size="sm" onPress={() => setPriceLogShown(c => Math.min(c + 24, descendingLog.length))}>
                      Show more ({descendingLog.length - priceLogShown})
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onPress={() => setPriceLogShown(12)}>
                      Show less
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </SidePanel>
  );
};

export default HoldingPanel;
