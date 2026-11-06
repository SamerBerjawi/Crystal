import React from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { Account, Currency, Transaction } from '../../types';
import type { SafeToSpend } from '../../utils/safeToSpend';
import type { SummaryFact, SummaryTarget } from '../../utils/overviewSummary';
import { parseLocalDate } from '../../utils';
import Icon from './Icon';
import { Button, TextLink } from './Actions';
import { CountPill, Row, Sparkline } from './Display';
import { AmountInput } from './Fields';
import { Amount, Change } from './Money';
import { Popover } from './Overlays';
import { EmptyState } from './States';
import { cn } from '../../lib/utils';
import { LogoTile } from '../EntityIcon';
import { usePreferencesSelector } from '../../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../../utils/brandfetch';
import { ACCOUNT_TYPE_STYLES } from '../../constants';
import { ACCOUNT_TYPE_ORDER, computeAccount90dSparkline } from '../../utils/accountsModel';
import { fitRows, useWidgetBox } from './WidgetGrid';
import { useAccountLogo } from '../useAccountLogo';
import { StatGauge, type GaugeTone } from './StatGauge';

/** The signature sentence: three facts at most, each linked to where you can act. */
export const WrittenSummary: React.FC<{ facts: SummaryFact[]; onFact: (id: SummaryTarget) => void; isPrivate?: boolean; className?: string }> = ({ facts, onFact, isPrivate, className }) => (
  <p className={cn('type-sentence max-w-[64ch] text-ink', className)}>
    {facts.length === 0 && 'Nothing needs you today. Nice.'}
    {facts.map((fact, index) => (
      <React.Fragment key={fact.id}>
        {index > 0 && (index === facts.length - 1 ? ' and ' : ', ')}
        <TextLink variant="summary" onPress={() => onFact(fact.id)}>
          {fact.id === 'income' && isPrivate ? 'Money' : fact.link}
        </TextLink>
        {fact.rest}
      </React.Fragment>
    ))}
    {facts.length > 0 && '.'}
  </p>
);

export interface HeroPart {
  label: string;
  value: number;
}

/** The green hero: the figure, the change in words and a sign, and a three-part split. Used once on a page. */
export const NetWorthHero: React.FC<{
  value: number;
  change: number | null;
  period: string;
  parts: HeroPart[];
  debts: number;
  currency: Currency;
  countUp: boolean;
  onOpen: () => void;
}> = ({ value, change, period, parts, debts, currency, countUp, onOpen }) => {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const shades = ['opacity-100', 'opacity-60', 'opacity-30'];

  return (
    <section aria-label="Net worth" className="net-worth-hero flex h-full flex-col justify-between gap-6 rounded-[var(--radius-xl)] bg-pine p-6 text-on-pine max-md:p-5 [--focus:var(--on-pine)]">
      <div>
        <button type="button" onClick={onOpen} className="type-label inline-flex min-h-6 cursor-pointer items-center gap-1 pointer-coarse:min-h-11">
          Net worth
          <Icon name="ChevronRight" size={16} />
        </button>
        <p className="type-figure-hero mt-1"><Amount value={value} currency={currency} countUp={countUp} /></p>
        {change !== null && <Change value={change} currency={currency} period={period} className="type-label mt-1" />}
      </div>
      <div>
        {total > 0 && (
          <div aria-hidden="true" className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {parts.map((part, index) => part.value > 0 && (
              <span key={part.label} className={cn('h-full bg-on-pine', shades[index])} style={{ width: `${(part.value / total) * 100}%` }} />
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:flex md:flex-wrap">
          {parts.map((part, index) => (
            <div key={part.label} className="min-w-0">
              <dt className="type-caption flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('size-2 rounded-full bg-on-pine', shades[index])} />
                {part.label}
              </dt>
              <dd className="type-figure-row"><Amount value={part.value} currency={currency} /></dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="type-caption">Debts</dt>
            <dd className="type-figure-row"><Amount value={debts > 0 ? -debts : 0} currency={currency} /></dd>
          </div>
        </dl>
      </div>
    </section>
  );
};

export interface NeedsYouItem {
  id: string;
  label: string;
  count: number;
  onOpen: () => void;
}

/** What's waiting, as a short list of counts. Each row is a link. */
export const NeedsYou: React.FC<{ items: NeedsYouItem[]; footer?: React.ReactNode }> = ({ items, footer }) => {
  const waiting = items.filter(item => item.count > 0);
  return (
    <section aria-labelledby="needs-you" className="flex h-full flex-col rounded-[var(--radius-xl)] surface-card p-6 max-md:p-5">
      <h2 id="needs-you" className="type-card-title mb-2 text-ink">Needs you</h2>
      {waiting.length === 0 ? (
        <p className="type-body flex flex-1 items-center text-muted">All clear. Nothing is waiting.</p>
      ) : (
        <ul className="-mx-2 flex-1">
          {waiting.map(item => (
            <li key={item.id}>
              <button type="button" onClick={item.onOpen} className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 text-left hover:bg-inset">
                <span className="type-body min-w-0 truncate text-ink">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted">
                  <CountPill count={item.count} />
                  <Icon name="ChevronRight" size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{footer}</div>}
    </section>
  );
};

const formatDay = (date: string) => parseLocalDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** What's left after bills and your cushion, until your next income. Can be hidden (D-053). */
export const SafeToSpendWidget: React.FC<{
  data: SafeToSpend;
  currency: Currency;
  toDisplay: (eur: number) => number;
  fromDisplay?: (displayAmount: number) => number;
  countUp?: boolean;
  onCushionChange: (amount: number) => void;
  size?: 's' | 'm' | 'l';
}> = ({ data, currency, toDisplay, fromDisplay, countUp, onCushionChange, size = 's' }) => {
  const displayCushion = data.cushion ? Math.round(toDisplay(data.cushion) * 100) / 100 : 0;
  const [cushionDraft, setCushionDraft] = React.useState(displayCushion ? String(displayCushion) : '');

  React.useEffect(() => {
    const next = data.cushion ? Math.round(toDisplay(data.cushion) * 100) / 100 : 0;
    setCushionDraft(next ? String(next) : '');
  }, [data.cushion, toDisplay]);

  const commitCushion = (raw: string) => {
    const parsed = Math.max(0, Number(raw.replace(',', '.')) || 0);
    const inEur = fromDisplay ? fromDisplay(parsed) : parsed;
    onCushionChange(Math.round(inEur * 100) / 100);
  };

  if (!data.accounts.length) {
    return <EmptyState className="py-4" icon="wallet" title="No spending account yet" description="Add a checking account to see what you can spend." />;
  }

  const box = useWidgetBox();
  // Side by side when there is width; stacked when there is not. The breakdown needs about 150px of height, the account line 190px.
  const sideBySide = box.width > 0 ? box.width >= 460 : size !== 's';
  const showBreakdown = box.height === 0 || box.height >= 150;
  const showSource = box.height === 0 || box.height >= 190;
  const isOver = data.amount < 0;
  const untilText = data.untilReason === 'income' ? `your next income on ${formatDay(data.until)}` : `the end of the month`;
  const rows: { label: string; value: number }[] = [
    { label: 'Cash', value: data.cash },
    { label: 'Bills before then', value: -data.upcoming },
    { label: 'Cushion', value: -data.cushion },
  ];

  return (
    <div className={cn('flex h-full gap-6', sideBySide ? 'items-stretch justify-between' : 'flex-col justify-between gap-3')}>
      <div className="min-w-0">
        <p className={cn('type-figure-lg', isOver ? 'text-money-out' : 'text-ink')}>
          <Amount value={toDisplay(data.amount)} currency={currency} countUp={countUp} />
        </p>
        <p className="type-caption mt-1 text-muted">
          {isOver ? <>Over by this much until {untilText}</> : <><Amount value={toDisplay(data.perDay)} currency={currency} /> a day until {untilText}</>}
        </p>
      </div>
      {showBreakdown && <div className="min-w-0">
        <dl className="space-y-1">
          {rows.map(row => (
            <div key={row.label} className="type-caption flex items-center justify-between gap-3">
              <dt className="text-muted">
                {row.label === 'Cushion' ? (
                  <Popover
                    title="Cushion"
                    placement="bottom start"
                    trigger={<AriaButton className="inline-flex min-h-6 cursor-pointer items-center underline underline-offset-2 pointer-coarse:min-h-11">Cushion</AriaButton>}
                  >
                    <AmountInput
                      className="w-56 max-md:w-full"
                      label="Keep back"
                      help="Taken off before showing what's safe to spend."
                      currency={currency}
                      value={cushionDraft}
                      onChange={text => {
                        setCushionDraft(text);
                        commitCushion(text);
                      }}
                    />
                  </Popover>
                ) : row.label}
              </dt>
              <dd className="text-ink"><Amount value={toDisplay(row.value)} currency={currency} /></dd>
            </div>
          ))}
        </dl>
        {showSource && <p className="type-caption mt-1 truncate text-muted">From {data.accounts.map(account => account.name).join(', ')}</p>}
      </div>}
    </div>
  );
};

/** One account's logo, or the icon its owner picked, or its type's icon. Logos come from the account's institution. */
export const AccountMark: React.FC<{ account: Account; size?: number }> = ({ account, size = 28 }) => {
  const logo = useAccountLogo(account, size);
  return <LogoTile url={logo} label={account.name} size={size} fallbackIcon={account.icon || ACCOUNT_TYPE_STYLES[account.type]?.icon || 'bank'} />;
};

/** Every open account, grouped by type with a subtotal, whatever the page filter says. Scrolls when there are more than fit. */
export const AccountsSummary: React.FC<{
  accounts: Account[];
  toDisplay: (amount: number, from: Currency) => number;
  currency: Currency;
  onOpen: (id: string) => void;
  onAll: () => void;
  size?: 's' | 'm' | 'l';
  /** With these, each row carries its 90-day balance trend. */
  transactions?: Transaction[];
  conversionRates?: Partial<Record<Currency, number>>;
}> = ({ accounts, toDisplay, currency, onOpen, onAll, transactions, conversionRates }) => {
  const box = useWidgetBox();
  const showTrend = !!transactions && (box.width === 0 || box.width >= 300);
  // Wider when the widget has room; slimmer when names would be squeezed.
  const trendWidth = box.width === 0 || box.width >= 420 ? 76 : 56;
  const trends = React.useMemo(() => {
    if (!showTrend || !transactions) return new Map<string, { data: { value: number }[]; isPositive: boolean }>();
    const byAccount = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const list = byAccount.get(tx.accountId);
      if (list) list.push(tx); else byAccount.set(tx.accountId, [tx]);
    }
    const result = new Map<string, { data: { value: number }[]; isPositive: boolean }>();
    for (const account of accounts) {
      if (account.status === 'closed') continue;
      const spark = computeAccount90dSparkline(account, byAccount.get(account.id) ?? [], undefined, { conversionRates });
      if (spark.sparklineData.length > 1) result.set(account.id, { data: spark.sparklineData.map(point => ({ value: point.value })), isPositive: spark.isPositiveTrend });
    }
    return result;
  }, [showTrend, transactions, accounts, conversionRates]);
  const groups = React.useMemo(() => {
    const open = accounts.filter(account => account.status !== 'closed');
    return ACCOUNT_TYPE_ORDER
      .map(type => {
        const members = open
          .filter(account => account.type === type)
          .sort((a, b) => Math.abs(toDisplay(b.balance, b.currency)) - Math.abs(toDisplay(a.balance, a.currency)));
        return { type, members, total: members.reduce((sum, account) => sum + toDisplay(account.balance, account.currency), 0) };
      })
      .filter(group => group.members.length > 0);
  }, [accounts, toDisplay]);
  const count = groups.reduce((sum, group) => sum + group.members.length, 0);

  if (count === 0) {
    return <EmptyState className="h-full py-4" icon="wallet" title="No accounts yet" description="Add one and it shows up here." actionLabel="Add an account" onAction={onAll} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar -mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
        {groups.map(group => (
          <section key={group.type} aria-label={group.type}>
            <h3 className="type-label sticky top-0 z-10 flex items-center justify-between gap-3 bg-solid/90 py-1 text-muted backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <Icon name={ACCOUNT_TYPE_STYLES[group.type]?.icon || 'bank'} size={14} />
                {group.type}
                <span className="font-normal">· {group.members.length}</span>
              </span>
              <Amount value={group.total} currency={currency} className="text-ink" />
            </h3>
            <ul className="divide-y divide-line">
              {group.members.map(account => (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(account.id)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-1 py-1.5 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                  >
                    <AccountMark account={account} />
                    <span className="min-w-0 flex-1">
                      <span className="type-body-strong block truncate text-ink">{account.name}</span>
                      {account.financialInstitution && <span className="type-caption block truncate text-muted">{account.financialInstitution}</span>}
                    </span>
                    {trends.has(account.id) && <Sparkline data={trends.get(account.id)!.data} isPositive={trends.get(account.id)!.isPositive} width={trendWidth} height={24} />}
                    <span className="type-figure-row shrink-0 text-ink"><Amount value={toDisplay(account.balance, account.currency)} currency={currency} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-1 shrink-0 self-start" onPress={onAll}>Open Accounts</Button>
    </div>
  );
};

export interface RatioGauge {
  /** 0 to 100. */
  fill: number;
  tone: GaugeTone;
  /** The figure for the middle of the gauge. */
  display: string;
  /** What the colour means, in a word. */
  status: string;
}

/** Liquidity, savings rate, debt ratio and net flow. Ratios with a target are gauges when there is room, figures when there is not. */
export const KeyRatios: React.FC<{
  items: { label: string; value: React.ReactNode; context: string; gauge?: RatioGauge }[];
  size?: 's' | 'm' | 'l';
}> = ({ items, size = 'm' }) => {
  const box = useWidgetBox();
  // Four across from 560px, two otherwise. A gauge needs about 150px of height; below that the ratios are figures.
  const columns = box.width > 0 ? (box.width >= 560 ? 4 : 2) : size === 'l' ? 4 : 2;
  const rowHeight = box.height > 0 ? box.height / Math.ceil(items.length / columns) : Infinity;
  const useGauges = rowHeight >= 150;
  const small = rowHeight < 64;
  const showContext = rowHeight >= 78;
  const gaugeSize = Math.max(96, Math.min(150, Math.round(rowHeight - 44), box.width > 0 ? Math.floor(box.width / columns) - 24 : 150));
  return (
    <dl className={cn("grid h-full content-center gap-x-6 gap-y-3", columns === 4 ? "grid-cols-4" : "grid-cols-2")}>
      {items.map(item => (
        <div key={item.label} className={cn('min-w-0', useGauges && 'flex flex-col items-center text-center')}>
          <dt className="type-caption truncate text-muted">{item.label}</dt>
          {useGauges && item.gauge ? (
            <dd>
              <StatGauge fill={item.gauge.fill} tone={item.gauge.tone} display={item.gauge.display} caption={item.gauge.status} size={gaugeSize} label={item.label} />
            </dd>
          ) : (
            <dd className={cn("truncate text-ink", small ? "type-body-strong" : "type-figure-lg")}>{item.value}</dd>
          )}
          {showContext && <dd className="type-caption truncate text-muted">{item.context}</dd>}
        </div>
      ))}
    </dl>
  );
};
