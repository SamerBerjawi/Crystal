import React, { useMemo, useState } from 'react';
import type { Account, HoldingSummary, InvestmentTransaction, PriceHistoryEntry, Warrant } from '../types';
import { convertCurrency, formatCurrency, parseLocalDate, getMainCurrency } from '../utils';
import { CANDLE_MIN_POINTS, formatHoldingType } from '../utils/investments';
import { ValueChart } from './AccountFrame';
import InvestmentCandlestickChart from './InvestmentCandlestickChart';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { Menu } from './ui/Menu';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';

const CHART_MODES = [{ id: 'line', label: 'Line' }, { id: 'candle', label: 'Candles' }];
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
}

/** A holding beside the portfolio (D-025): what it's worth, how it got there, and its logged prices. */
const HoldingPanel: React.FC<HoldingPanelProps> = ({ holding, account, trades, grants, priceLog, onClose, onLogPrice, onDeletePrice, onTrade, onEditTrade, onEditGrant }) => {
  const [chartMode, setChartMode] = useState('line');
  const currency = holding.currency ?? 'EUR';
  const canShowCandles = priceLog.length >= CANDLE_MIN_POINTS;
  const gain = holding.priceUnavailable ? null : holding.currentValue - holding.totalCost;
  const gainPct = gain !== null && holding.totalCost > 0 ? (gain / holding.totalCost) * 100 : null;
  const averageCost = holding.quantity > 0 ? holding.totalCost / holding.quantity : 0;
  const nativeAverageCost = holding.quantity > 0 ? convertCurrency(averageCost, getMainCurrency(), currency) : 0;
  const lastLogged = priceLog[priceLog.length - 1];
  const chartData = useMemo(() => priceLog.map(entry => ({ date: fullDate(entry.date), value: entry.price })), [priceLog]);

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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div><dt className="type-label text-muted">Value</dt><dd className="type-figure-lg text-ink"><Amount value={holding.currentValue} currency={getMainCurrency()} /></dd></div>
        <div>
          <dt className="type-label text-muted">Return</dt>
          <dd className="type-figure-lg text-ink">
            {gain === null ? <span className="type-body text-muted">No price yet</span> : <><Amount value={gain} currency={getMainCurrency()} tone="flow" />{gainPct !== null && <span className="type-caption text-muted"> {gainPct >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)}%</span>}</>}
          </dd>
        </div>
        <div><dt className="type-label text-muted">Average cost</dt><dd className="type-figure-row text-ink"><Amount value={averageCost} currency={getMainCurrency()} /></dd></div>
        <div>
          <dt className="type-label text-muted">Market price</dt>
          <dd className="type-figure-row text-ink"><Amount value={holding.currentPrice} currency={currency} /></dd>
          {lastLogged && <dd className="type-caption text-muted">Logged {fullDate(lastLogged.date)}</dd>}
        </div>
        <div><dt className="type-label text-muted">Units</dt><dd className="type-figure-row text-ink">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</dd></div>
        <div><dt className="type-label text-muted">Cost</dt><dd className="type-figure-row text-ink"><Amount value={holding.totalCost} currency={getMainCurrency()} /></dd></div>
      </dl>

      <section aria-label="Price" className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="type-card-title text-ink">Price</h3>
          {canShowCandles && <SegmentedControl items={CHART_MODES} activeId={chartMode} onChange={setChartMode} />}
        </div>
        {priceLog.length < 2 ? (
          <p className="type-body text-muted">Log at least two prices to see a chart.</p>
        ) : chartMode === 'candle' && canShowCandles ? (
          <>
            <InvestmentCandlestickChart currentValue={holding.currentPrice} costBasis={holding.quantity > 0 ? nativeAverageCost : undefined} priceHistory={priceLog} currency={currency} />
            <p className="type-caption mt-1 text-muted">Candles come from the prices logged in each period, not from market trading data.</p>
          </>
        ) : (
          <ValueChart data={chartData} currency={currency} dataKey="value" fitValues />
        )}
      </section>

      <section aria-label="Activity" className="mt-5 border-t border-line pt-4">
        <h3 className="type-card-title text-ink">Activity</h3>
        {activity.length === 0 ? <p className="type-body mt-1 text-muted">No trades yet.</p> : (
          <ul className="mt-1 divide-y divide-line">
            {activity.map(item => (
              <li key={item.id} className="flex min-h-12 items-center gap-2 py-1">
                <Badge tone={item.label === 'Sell' ? 'attention' : item.label === 'Grant' ? 'neutral' : 'positive'}>{item.label}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="type-body block truncate text-ink">{item.quantity.toLocaleString()} at {formatCurrency(item.price, item.tradeCurrency)}</span>
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
        <h3 className="type-card-title text-ink">Price log</h3>
        {descendingLog.length === 0 ? <p className="type-body mt-1 text-muted">No prices logged yet.</p> : (
          <ul className="mt-1 divide-y divide-line">
            {descendingLog.slice(0, 12).map(entry => (
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
        )}
      </section>
    </SidePanel>
  );
};

export default HoldingPanel;
