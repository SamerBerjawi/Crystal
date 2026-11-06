import React, { useMemo } from 'react';
import { Account, Transaction } from '../types';
import { convertToMain, parseLocalDate, getMainCurrency } from '../utils';
import { LIQUID_ACCOUNT_TYPES } from '../constants';
import { Badge } from './ui/Display';
import { Amount } from './ui/Money';
import { useWidgetBox } from './ui/WidgetGrid';
import { StatGauge } from './ui/StatGauge';

interface FinancialRunwayWidgetProps {
  accounts: Account[];
  transactions: Transaction[];
}

/** How many months your cash lasts at the last three months' spending, with no new income. */
const FinancialRunwayWidget: React.FC<FinancialRunwayWidgetProps> = ({ accounts, transactions }) => {
  const { months, monthlyBurn, liquidAssets } = useMemo(() => {
    const liquid = accounts
      .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type) && a.status !== 'closed')
      .reduce((sum, a) => sum + convertToMain(a.balance, a.currency), 0);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const spent = transactions
      .filter(t => t.type === 'expense' && !t.transferId && !t.isSplitParent && !t.isCombinedParent && parseLocalDate(t.date) >= ninetyDaysAgo)
      .reduce((sum, t) => sum + Math.abs(convertToMain(t.amount, t.currency)), 0);

    const burn = spent / 3;
    return { months: burn > 0 ? liquid / burn : null, monthlyBurn: burn, liquidAssets: liquid };
  }, [accounts, transactions]);

  const currency = getMainCurrency();
  const box = useWidgetBox();
  // The figure and bar always show. The two amounts need about 210px and the note about 290px.
  const showAmounts = box.height === 0 || box.height >= 210;
  // With about 320px of height the figure becomes a gauge against a year of cover.
  const showGauge = months !== null && box.height >= 320 && box.width >= 220;
  const showNote = box.height === 0 || box.height >= 290;
  const status = months === null ? null
    : months < 3 ? { tone: 'negative' as const, label: 'Under 3 months' }
    : months > 12 ? { tone: 'positive' as const, label: 'Over a year' }
    : { tone: 'neutral' as const, label: '3 to 12 months' };

  return (
    <div className={`flex h-full flex-col ${showAmounts ? 'gap-4' : 'justify-center gap-3'}`}>
      {showGauge && status && (
        <div className="flex flex-col items-center gap-2">
          <StatGauge fill={(months! / 12) * 100} tone={status.tone === 'negative' ? 'loss' : status.tone === 'positive' ? 'pine' : 'amber'} display={months!.toFixed(1)} caption={months!.toFixed(1) === '1.0' ? 'month' : 'months'} size={Math.min(160, Math.floor(box.width - 24), Math.floor(box.height * 0.42))} label="Cash runway" />
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      )}
      {!showGauge && <div className="flex items-start justify-between gap-3">
        {months === null ? (
          <p className="type-body-strong text-muted">Not enough spending to measure</p>
        ) : (
          <p className="type-figure-hero text-ink">
            {months.toFixed(1)}
            <span className="type-body ml-1.5 text-muted">{months.toFixed(1) === '1.0' ? 'month' : 'months'}</span>
          </p>
        )}
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>}

      {!showGauge && <div className="h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(((months ?? 0) / 12) * 100, 100)}%` }} />
      </div>}

      {showAmounts && <dl className="divide-y divide-line">
        <div className="type-body flex justify-between gap-3 py-2">
          <dt className="text-muted">Cash you can reach</dt>
          <dd className="type-figure-row text-ink"><Amount value={liquidAssets} currency={currency} /></dd>
        </div>
        <div className="type-body flex justify-between gap-3 py-2">
          <dt className="text-muted">Spending a month</dt>
          <dd className="type-figure-row text-ink"><Amount value={monthlyBurn} currency={currency} /></dd>
        </div>
      </dl>}

      {showNote && (
        <p className="type-caption mt-auto text-muted">
          {months === null ? 'No spending in the last 3 months, so there’s nothing to measure against.' : 'At your average spending over the last 3 months, with no new income.'}
        </p>
      )}
    </div>
  );
};

export default FinancialRunwayWidget;
