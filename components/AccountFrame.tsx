import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Account, Category, Currency, DisplayTransaction, FinancialGoal, Transaction } from '../types';
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { Bar, BarChart, BarXAxis, BarYAxis, ChartTooltip, Grid } from '../src/components/charts';
import { formatCurrency } from '../utils';
import { AccountLogo } from './AccountCard';
import HistoricalBalanceTrend from './HistoricalBalanceTrend';
import TransactionList from './TransactionList';
import { Button, IconButton } from './ui/Actions';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

export interface FrameMetric {
  label: string;
  value: React.ReactNode;
  context?: string;
}

/** A section of a tab. */
export const Panel: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({ title, subtitle, className, children }) => (
  <section className={cn('min-w-0 rounded-[var(--radius-xl)] border border-line bg-surface p-6 max-md:p-5', className)}>
    <h3 className="type-card-title text-ink">{title}</h3>
    {subtitle && <p className="type-caption text-muted">{subtitle}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

/** Summary cards: four across, two by two on tablets, a scrolling row on phones. */
export const MetricRow: React.FC<{ metrics: FrameMetric[] }> = ({ metrics }) => (
  <dl className="no-scrollbar flex gap-3 overflow-x-auto md:grid md:grid-cols-2 md:gap-4 md:overflow-visible lg:grid-cols-4">
    {metrics.map(metric => (
      <div key={metric.label} className="min-w-[160px] shrink-0 rounded-[var(--radius-xl)] border border-line bg-surface p-5 md:min-w-0">
        <dt className="type-label text-muted">{metric.label}</dt>
        <dd className="type-figure-lg mt-1 truncate text-ink">{metric.value}</dd>
        {metric.context && <dd className="type-caption mt-0.5 text-muted">{metric.context}</dd>}
      </div>
    ))}
  </dl>
);

/** Label and value rows for an account's settings and specifications. */
export const DetailList: React.FC<{ items: { label: string; value?: React.ReactNode }[] }> = ({ items }) => (
  <dl className="divide-y divide-line">
    {items.filter(item => item.value !== undefined && item.value !== null && item.value !== '').map(item => (
      <div key={item.label} className="flex min-h-10 items-center justify-between gap-4 py-1.5">
        <dt className="type-body text-muted">{item.label}</dt>
        <dd className="type-body-strong min-w-0 truncate text-right text-ink">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const ProgressBar: React.FC<{ value: number; label: string; className?: string; tone?: 'primary' | 'onHero' }> = ({ value, label, className, tone = 'primary' }) => (
  <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 overflow-hidden rounded-full', tone === 'onHero' ? 'bg-on-primary/25' : 'bg-inset', className)}>
    <div className={cn('h-full rounded-full', tone === 'onHero' ? 'bg-on-primary' : 'bg-primary')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

export const LinkedGoals: React.FC<{ goals: FinancialGoal[] }> = ({ goals }) => (
  <ul className="space-y-3">
    {goals.map(goal => {
      const progress = goal.amount > 0 ? (goal.currentAmount / goal.amount) * 100 : 0;
      return (
        <li key={goal.id}>
          <p className="type-body mb-1 flex justify-between gap-3 text-ink">
            <span className="truncate">{goal.name}</span>
            <span className="type-figure-row shrink-0">{progress.toFixed(0)}%</span>
          </p>
          <ProgressBar value={progress} label={goal.name} />
        </li>
      );
    })}
  </ul>
);

export const MonthlyBars: React.FC<{ data: Record<string, unknown>[]; currency: Currency; bars: { key: string; color: string }[]; stacked?: boolean }> = ({ data, currency, bars, stacked }) => (
  <div className="h-[220px] md:h-[280px]">
    <BarChart data={data} xDataKey="name" stacked={stacked} aspectRatio="auto" margin={{ top: 15, right: 15, left: 15, bottom: 25 }}>
      <Grid horizontal vertical={false} strokeOpacity={0.06} />
      {bars.map(bar => <Bar key={bar.key} dataKey={bar.key} fill={bar.color} lineCap="round" />)}
      <BarXAxis />
      <BarYAxis />
      <ChartTooltip valueFormatter={(value: number) => formatCurrency(value, currency)} />
    </BarChart>
  </div>
);

export const ValueChart: React.FC<{ data: Record<string, unknown>[]; currency: Currency; dataKey: string; trendKey?: string }> = ({ data, currency, dataKey, trendKey }) => (
  <div className="h-[220px] md:h-[280px]">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={48} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} tickFormatter={value => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }} formatter={(value: number) => [formatCurrency(value, currency), 'Value']} />
        <Area type="monotone" dataKey={dataKey} stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.12} />
        {trendKey && <Line type="monotone" dataKey={trendKey} stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export interface FrameTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface FrameAction {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
}

export interface AccountFrameProps {
  account: Account;
  /** Shown under the name. */
  context: string;
  /** The hero figure. Defaults to the account's balance. */
  value?: number;
  valueLabel?: string;
  /** Small figures in the hero. */
  highlights?: FrameMetric[];
  /** Extra hero content, such as a progress bar or a photo. */
  heroExtra?: React.ReactNode;
  banner?: React.ReactNode;
  mainAction?: FrameAction;
  actions?: FrameAction[];
  tabs: FrameTab[];
  transactionsForChart: Transaction[];
  onBack: () => void;
}

/** One frame for every account type (D-038): hero, chart, then tabs. */
const AccountFrame: React.FC<AccountFrameProps> = ({ account, context, value, valueLabel = 'Balance', highlights = [], heroExtra, banner, mainAction, actions = [], tabs, transactionsForChart, onBack }) => {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find(tab => tab.id === activeId) ?? tabs[0];
  const menuItems = useMemo<MenuAction[]>(() => actions.map(action => ({ id: action.id, label: action.label, icon: action.icon, onAction: action.onPress })), [actions]);

  return (
    <div className="space-y-6 max-md:space-y-4">
      <header className="flex items-center gap-2">
        <IconButton icon="ArrowLeft" label="Back to accounts" onPress={onBack} tooltipPlacement="bottom" />
        <AccountLogo account={account} />
        <div className="min-w-0 flex-1">
          <h1 className="type-section-title truncate text-ink">{account.name}</h1>
          <p className="type-caption truncate text-muted">{context}</p>
        </div>
        {actions.length > 0 && <div className="flex shrink-0 gap-2 max-md:hidden">{actions.map(action => <Button key={action.id} variant="secondary" icon={action.icon} onPress={action.onPress}>{action.label}</Button>)}</div>}
        {mainAction && <Button icon={mainAction.icon} className="shrink-0 max-md:hidden" onPress={mainAction.onPress}>{mainAction.label}</Button>}
      </header>

      {banner}

      <section aria-label={valueLabel} className="space-y-4 rounded-[var(--radius-xl)] bg-primary p-6 text-on-primary max-md:p-5 [--focus:var(--on-primary)]">
        <div>
          <p className="type-label">{valueLabel}</p>
          <p className="type-figure-hero break-words"><Amount value={value ?? account.balance} currency={account.currency} /></p>
        </div>
        {heroExtra}
        {highlights.length > 0 && (
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {highlights.map(item => (
              <div key={item.label}>
                <dt className="type-caption">{item.label}</dt>
                <dd className="type-figure-row">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {(mainAction || actions.length > 0) && (
        <div className="flex gap-2 md:hidden">
          {mainAction && <Button icon={mainAction.icon} className="min-w-0 flex-1" onPress={mainAction.onPress}>{mainAction.label}</Button>}
          {menuItems.length === 1 && <Button variant="secondary" icon={actions[0].icon} className="min-w-0 flex-1" onPress={actions[0].onPress}>{actions[0].label}</Button>}
          {menuItems.length > 1 && <Menu title="Account actions" trigger={<IconButton icon="more_horiz" label="More actions" />} items={menuItems} />}
        </div>
      )}

      <HistoricalBalanceTrend account={account} transactions={transactionsForChart} />

      {tabs.length > 1 && (
        <div role="tablist" aria-label={`${account.name} sections`} className="no-scrollbar flex gap-5 overflow-x-auto border-b border-line">
          {tabs.map(tab => {
            const isActive = tab.id === active?.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
                className={cn('relative h-11 shrink-0 cursor-pointer whitespace-nowrap text-sm font-bold', isActive ? 'text-ink' : 'text-muted hover:text-ink')}
              >
                {tab.label}
                {isActive && <motion.span layoutId="account-tab" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" className="space-y-4">{active?.content}</div>
    </div>
  );
};

/** The Transactions tab, shared by every type that has one. */
export const AccountTransactions: React.FC<{ transactions: DisplayTransaction[]; categories: Category[]; onOpen: (tx: DisplayTransaction) => void; emptyAction?: () => void }> = ({ transactions, categories, onOpen, emptyAction }) => (
  transactions.length > 0
    ? <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-4"><TransactionList transactions={transactions} allCategories={categories} onTransactionClick={onOpen} density="high" /></div>
    : <EmptyState icon="receipt" title="No transactions yet" description="They appear here as you add them or sync your bank." actionLabel={emptyAction ? 'Add a transaction' : undefined} onAction={emptyAction} />
);

export default AccountFrame;
