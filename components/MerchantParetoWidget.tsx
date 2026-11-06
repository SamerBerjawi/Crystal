import React, { useMemo } from 'react';
import { Currency, Transaction } from '../types';
import { convertToMain, formatCurrency, getMainCurrency } from '../utils';
import { BarChart, Bar, Grid, BarYAxis, ChartTooltip } from '@/src/components/charts';
import { EmptyState } from './ui/States';
import { fitRows, useWidgetBox } from './ui/WidgetGrid';
import { Amount } from './ui/Money';

interface MerchantParetoWidgetProps {
  transactions: Transaction[];
  currency?: Currency;
  toDisplay?: (eur: number) => number;
}

/** Your eight biggest merchants by spending, with the top three picked out. */
const MerchantParetoWidget: React.FC<MerchantParetoWidgetProps> = ({
  transactions,
  currency = getMainCurrency(),
  toDisplay = (val: number) => val,
}) => {
  const { sorted, topThreePercent } = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0;
    for (const tx of transactions) {
      if (tx.isSplitParent || tx.isCombinedParent || tx.isBalanceAdjustment) continue;
      if (tx.type !== 'expense' || tx.transferId || !tx.merchant) continue;
      const amount = Math.abs(toDisplay(convertToMain(tx.amount, tx.currency)));
      const merchant = tx.merchant.trim();
      totals.set(merchant, (totals.get(merchant) || 0) + amount);
      total += amount;
    }
    const top = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    const topThree = top.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
    return { sorted: top, topThreePercent: total > 0 ? (topThree / total) * 100 : 0 };
  }, [transactions, toDisplay]);

  const box = useWidgetBox();
  // A chart needs about 260px. Shorter than that, the merchants are a ranked list that fills what room there is.
  const asList = box.height > 0 && box.height < 280;
  const listCount = Math.min(sorted.length, fitRows(box, 30, 4, 28));
  const labelRoom = box.width > 0 && box.width < 380 ? 70 : 90;

  if (sorted.length === 0) {
    return <EmptyState icon="store-01" title="No merchants yet" description="Spending with a merchant set shows up here." className="h-full py-6" />;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <p className={`${asList ? 'type-caption' : 'type-body'} text-muted`}>
        Your top 3 take <span className="type-body-strong text-ink">{topThreePercent.toFixed(0)}%</span> of your spending with a merchant.
      </p>
      {asList ? (
        <ol className="min-h-0 flex-1 divide-y divide-line overflow-hidden">
          {sorted.slice(0, listCount).map((item, index) => (
            <li key={item.name} className="type-body flex items-center justify-between gap-3 py-1">
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: index < 3 ? 'var(--chart-1)' : 'var(--chart-4)' }} aria-hidden />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="type-figure-row shrink-0 text-ink"><Amount value={item.value} currency={currency} /></span>
            </li>
          ))}
        </ol>
      ) : (
      <div className="min-h-[120px] flex-1">
        <BarChart data={sorted} xDataKey="name" orientation="horizontal" aspectRatio="auto" margin={{ top: 10, right: 30, left: labelRoom, bottom: 10 }} className="h-full w-full">
          <Grid vertical horizontal={false} stroke="var(--line)" />
          <Bar dataKey="value" fill={(_, index) => (index < 3 ? 'var(--chart-1)' : 'var(--chart-4)')} lineCap="round" />
          <BarYAxis />
          <ChartTooltip valueFormatter={(val: number) => formatCurrency(val, currency)} />
        </BarChart>
      </div>
      )}
    </div>
  );
};

export default MerchantParetoWidget;
