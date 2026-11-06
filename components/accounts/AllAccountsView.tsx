import React, { useMemo, useState } from 'react';
import type { Account, Transaction } from '../../types';
import { convertCurrency, convertToMain, getMainCurrency } from '../../utils';
import { accountLinks } from '../../utils/accountLinks';
import { computeAccount90dSparkline, computeAccountDisplayBalance } from '../../utils/accountsModel';
import { HUB_GROUPS, hubGroupOf, isoDay, moneyMap, netWorthHistory, toDatedAmounts, type HubGroup } from '../../utils/accountPagesModel';
import { usePreferencesSelector } from '../../contexts/DomainProviders';
import { useGoalsContext, useScheduleContext } from '../../contexts/FinancialDataContext';
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from '../../src/components/charts/sankey';
import { AreaSparkline } from '../../src/components/charts';
import { formatCurrency } from '../../utils';
import { AccountLogo } from '../AccountCard';
import { Badge } from '../ui/Display';
import { Menu, type MenuAction } from '../ui/Menu';
import { IconButton } from '../ui/Actions';
import { Amount } from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import { cn } from '../../lib/utils';
import { Donut, Section, TimeSeries } from './charts';

const GROUP_COLOR: Record<HubGroup, string> = {
  Cash: 'var(--pine)',
  Savings: 'var(--hero-savings)',
  Cards: 'var(--hero-credit-card)',
  Investments: 'var(--hero-investment)',
  Property: 'var(--hero-property)',
  Vehicles: 'var(--hero-vehicle)',
  'Other assets': 'var(--hero-other-assets)',
  Loans: 'var(--hero-loan)',
  'Other debts': 'var(--hero-other-liabilities)',
};

const RANGES = [
  { id: '6', label: '6M' },
  { id: '12', label: '1Y' },
  { id: '24', label: '2Y' },
];

interface AllAccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  transactionsByAccount: Record<string, Transaction[]>;
  onOpen: (id: string) => void;
  onOpenTab: (tab: 'accounts' | 'cards' | 'loans' | 'assets' | null) => void;
  menuFor: (account: Account) => MenuAction[];
}

/**
 * The All tab (12-account-pages): net worth and how it moved, what it's made of, how money flows between the
 * accounts, then every account grouped by type with its links.
 */
const AllAccountsView: React.FC<AllAccountsViewProps> = ({ accounts, transactions, transactionsByAccount, onOpen, onOpenTab, menuFor }) => {
  const { loanPaymentOverrides } = useScheduleContext();
  const { financialGoals } = useGoalsContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const preferredCurrency = usePreferencesSelector(p => (p.currency || 'EUR') as string);
  const [range, setRange] = useState('12');
  const main = getMainCurrency();
  const toDisplay = (value: number) => convertCurrency(value, main, preferredCurrency, conversionRates);

  const open = useMemo(() => accounts.filter(account => account.status !== 'closed'), [accounts]);
  const counted = useMemo(() => open.filter(account => account.includeInAnalytics ?? true), [open]);
  const balances = useMemo(() => new Map(open.map(account => [account.id, computeAccountDisplayBalance(account, transactionsByAccount[account.id] || [], loanPaymentOverrides, { conversionRates })])), [open, transactionsByAccount, loanPaymentOverrides, conversionRates]);
  const inMain = (account: Account) => toDisplay(convertToMain(balances.get(account.id) ?? 0, account.currency, conversionRates));

  const history = useMemo(() => {
    const items = counted.map(account => ({
      account,
      todayBalance: balances.get(account.id) ?? 0,
      amounts: toDatedAmounts((transactionsByAccount[account.id] || []).filter(tx => !tx.isSplitParent && !tx.isCombinedParent), tx => convertCurrency(tx.amount, tx.currency || account.currency, account.currency, conversionRates)),
    }));
    return netWorthHistory(items, Number(range), (value, account) => toDisplay(convertToMain(value, account.currency, conversionRates)));
    // toDisplay is stable for a given rate table and currency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counted, balances, transactionsByAccount, conversionRates, range, preferredCurrency]);

  const now = history[history.length - 1] ?? { assets: 0, debts: 0, net: 0 };
  const monthAgo = history[history.length - 2];
  const first = history[0];

  const groups = useMemo(() => {
    const map = new Map<HubGroup, Account[]>();
    open.forEach(account => {
      const group = hubGroupOf(account);
      map.set(group, [...(map.get(group) || []), account]);
    });
    return HUB_GROUPS.filter(group => map.has(group.id)).map(group => {
      const list = map.get(group.id)!;
      const total = list.filter(account => account.includeInAnalytics ?? true).reduce((sum, account) => sum + inMain(account), 0);
      return { ...group, accounts: list, total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, balances, conversionRates, preferredCurrency]);

  const composition = useMemo(() => ({
    assets: groups.filter(group => group.total > 0).map(group => ({ label: group.id, value: group.total, color: GROUP_COLOR[group.id] })),
    debts: groups.filter(group => group.total < 0).map(group => ({ label: group.id, value: -group.total, color: GROUP_COLOR[group.id] })),
  }), [groups]);

  const flow = useMemo(() => {
    const today = new Date();
    const since = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90));
    return moneyMap(open, transactions, since, tx => toDisplay(convertToMain(tx.amount, tx.currency, conversionRates)), account => GROUP_COLOR[hubGroupOf(account)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactions, conversionRates, preferredCurrency]);

  const pickGroup = (label: string) => {
    const group = HUB_GROUPS.find(item => item.id === label);
    if (group) onOpenTab(group.tab);
  };
  const assetsShare = now.assets + now.debts > 0 ? (now.assets / (now.assets + now.debts)) * 100 : 100;

  return (
    <div className="space-y-4">
      <section aria-label="Net worth" className="surface-card space-y-5 rounded-[var(--radius-xl)] p-6 max-md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="type-label text-muted">Net worth</p>
            <p className="type-figure-hero text-ink"><Amount value={now.net} currency={preferredCurrency} /></p>
            <p className="type-body text-muted">
              {monthAgo && <><Amount value={now.net - monthAgo.net} currency={preferredCurrency} tone="flow" /> this month</>}
              {first && first !== monthAgo && <>, <Amount value={now.net - first.net} currency={preferredCurrency} tone="flow" /> over {RANGES.find(item => item.id === range)?.label}</>}
            </p>
          </div>
          <SegmentedControl items={RANGES} activeId={range} onChange={setRange} />
        </div>
        <div className="space-y-1.5">
          <div className="flex h-3 overflow-hidden rounded-full bg-inset" role="img" aria-label={`Assets ${Math.round(assetsShare)}%, debts ${Math.round(100 - assetsShare)}%`}>
            <div className="h-full bg-money-in" style={{ width: `${assetsShare}%` }} />
            <div className="h-full bg-money-out" style={{ width: `${100 - assetsShare}%` }} />
          </div>
          <div className="type-caption flex justify-between text-muted">
            <span>Assets <span className="type-figure-row text-ink"><Amount value={now.assets} currency={preferredCurrency} /></span></span>
            <span>Debts <span className="type-figure-row text-ink"><Amount value={now.debts} currency={preferredCurrency} /></span></span>
          </div>
        </div>
        <TimeSeries
          data={history}
          series={[
            { key: 'net', label: 'Net worth', color: 'var(--chart-1)', width: 2.5 },
            { key: 'assets', label: 'Assets', color: 'var(--money-in)', dashed: true, width: 1.5 },
            { key: 'debts', label: 'Debts', color: 'var(--money-out)', dashed: true, width: 1.5 },
          ]}
          currency={preferredCurrency}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What you own" subtitle="Pick a group to see it">
          <Donut items={composition.assets} currency={preferredCurrency} centerLabel="Assets" onPick={pickGroup} />
        </Section>
        <Section title="What you owe">
          {composition.debts.length ? <Donut items={composition.debts} currency={preferredCurrency} centerLabel="Debts" onPick={pickGroup} /> : <p className="type-body text-muted">No debts. Nice.</p>}
        </Section>
      </div>

      {flow.links.length > 0 && (
        <Section title="Money map" subtitle="Last 90 days: income into your accounts, what moved on to savings, cards, loans and investments, and what was spent from each">
          <div className="h-[340px] w-full max-md:h-[420px]">
            <SankeyChart data={flow} aspectRatio={undefined} nodeWidth={14} nodePadding={18} margin={{ top: 12, right: 120, bottom: 12, left: 120 }} className="h-full w-full">
              <SankeyLink useGradient getNodeColor={node => (node as unknown as { color?: string }).color || 'var(--chart-1)'} strokeOpacity={0.4} fadedOpacity={0.08} />
              <SankeyNode lineCap={4} labelOrientation="horizontal" getNodeColor={node => (node as unknown as { color?: string }).color || 'var(--chart-1)'} formatValue={(value: number) => formatCurrency(value, preferredCurrency)} />
              <SankeyTooltip />
            </SankeyChart>
          </div>
        </Section>
      )}

      {groups.map(group => (
        <section key={group.id} aria-label={group.id} className="surface-card rounded-[var(--radius-xl)] p-4">
          <header className="flex items-center justify-between gap-3 px-2 pb-2">
            <button type="button" onClick={() => onOpenTab(group.tab)} className="flex cursor-pointer items-center gap-2 text-left" disabled={!group.tab}>
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: GROUP_COLOR[group.id] }} />
              <h2 className="type-card-title text-ink">{group.id}</h2>
              <span className="type-caption text-muted">{group.accounts.length}</span>
            </button>
            <span className="type-figure-row text-ink"><Amount value={group.total} currency={preferredCurrency} /></span>
          </header>
          <ul className="divide-y divide-line">
            {group.accounts.map(account => (
              <AccountLine key={account.id} account={account} balance={balances.get(account.id) ?? 0} transactions={transactionsByAccount[account.id] || []} accounts={accounts} goals={financialGoals} onOpen={onOpen} menuItems={menuFor(account)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

/** One account in a group: logo, name, a 90-day sparkline, its balance, and up to two links. */
const AccountLine: React.FC<{ account: Account; balance: number; transactions: Transaction[]; accounts: Account[]; goals: ReturnType<typeof useGoalsContext>['financialGoals']; onOpen: (id: string) => void; menuItems: MenuAction[] }> = ({ account, balance, transactions, accounts, goals, onOpen, menuItems }) => {
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const spark = useMemo(() => computeAccount90dSparkline(account, transactions, balance, { conversionRates }), [account, transactions, balance, conversionRates]);
  const links = useMemo(() => accountLinks(account, { accounts, goals }).filter(link => link.target.type === 'account').slice(0, 2), [account, accounts, goals]);
  return (
    <li className="flex min-h-16 items-center gap-3 px-2 py-2">
      <button type="button" onClick={() => onOpen(account.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] text-left">
        <AccountLogo account={account} size={36} />
        <span className="min-w-0 flex-1">
          <span className="type-body-strong block truncate text-ink">{account.name}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="type-caption truncate text-muted">{account.financialInstitution || account.subType || account.otherSubType || account.type}</span>
            {links.map(link => link.target.type === 'account' && (
              <Badge key={link.kind + link.target.account.id} icon="link-01" className="max-md:hidden">{link.label} {link.target.account.name}</Badge>
            ))}
          </span>
        </span>
        <span className={cn('w-28 shrink-0 max-md:hidden')}>
          {spark.sparklineData.length > 1 && <AreaSparkline data={spark.sparklineData.map((point, index) => ({ index, value: point.value }))} dataKey="value" height={32} curve="natural" color={spark.isPositiveTrend ? 'var(--money-in)' : 'var(--money-out)'} animationDuration={900} />}
        </span>
        <span className="type-figure-row shrink-0 text-right text-ink"><Amount value={balance} currency={account.currency} /></span>
      </button>
      <Menu title={account.name} trigger={<IconButton icon="more-horizontal" label={`Actions for ${account.name}`} tooltipPlacement="left" />} items={menuItems} />
    </li>
  );
};

export default AllAccountsView;
