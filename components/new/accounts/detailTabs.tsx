import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import type { Account } from '../../../types';
import type { AccountDetailData } from '../../../hooks/useAccountDetailData';
import { formatShortDate } from '../../../utils/dateFormat';
import type { TxRow } from '../../../utils/transactionsModel';
import { groupAccountsByType, getVisibleAccountsForAccountsPage } from '../../../utils/accountsModel';
import {
  detailTabsFor,
  resolveDetailTab,
  type AccountArchetypeId,
  type AccountDetailTabId,
} from '../../../utils/accountDetailModel';
import { AccountLogo } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { confirmNew } from '../ConfirmDialog';
import { toast } from '../toast';
import { Button, Card, Money, SegmentedTabs } from '../ui';
import { useTransactionsData } from '../../../hooks/useTransactionsData';
import { TransactionSheet } from '../transactions/sheets';
import { RecurringSheet, SplitSheet } from '../transactions/actions';

/*
 * Account page workspace (docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md Phase 4.1, Q10, N21):
 * body tabs under the hero, the quick account switcher, and the Details tab.
 */

const STORAGE_PREFIX = 'crystal-new.account-tab.';

const readStoredTab = (archetype: AccountArchetypeId): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + archetype);
  } catch {
    return null;
  }
};

const storeTab = (archetype: AccountArchetypeId, tab: AccountDetailTabId) => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + archetype, tab);
  } catch {
    /* private mode or blocked storage: the tab just isn't remembered */
  }
};

/**
 * The open tab for an account page. The URL hash (`#plan`) wins, then the tab last used on this
 * kind of account, then Overview. Changing tab updates the hash (Overview clears it) without a
 * history entry, so Back still leaves the page.
 */
export const useAccountDetailTab = (account: Account | undefined, archetype: AccountArchetypeId) => {
  const tabs = useMemo(() => (account ? detailTabsFor(account, archetype) : []), [account, archetype]);
  const [tab, setTabState] = useState<AccountDetailTabId>(() =>
    resolveDetailTab(tabs, window.location.hash, readStoredTab(archetype))
  );

  // Another account (or a different kind of account) re-resolves the tab.
  useEffect(() => {
    setTabState(resolveDetailTab(tabs, window.location.hash, readStoredTab(archetype)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, archetype]);

  useEffect(() => {
    const onHash = () => setTabState(resolveDetailTab(tabs, window.location.hash, readStoredTab(archetype)));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tabs, archetype]);

  const setTab = useCallback(
    (next: AccountDetailTabId) => {
      setTabState(next);
      storeTab(archetype, next);
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', next === 'overview' ? `${pathname}${search}` : `${pathname}${search}#${next}`);
    },
    [archetype]
  );

  return { tabs, tab, setTab };
};

/** The tab bar, directly above what it switches (N21). Scrolls sideways when it does not fit. */
export const AccountDetailTabBar: React.FC<{
  tabs: ReturnType<typeof useAccountDetailTab>['tabs'];
  value: AccountDetailTabId;
  onChange: (tab: AccountDetailTabId) => void;
}> = ({ tabs, value, onChange }) => (
  <SegmentedTabs<AccountDetailTabId>
    label="Account sections"
    items={tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
    value={value}
    onChange={onChange}
  />
);

/* ── Quick account switcher ──────────────────────────────────────────────── */

/**
 * The account name in the hero as a menu of every open account, grouped like the Accounts list,
 * so you can jump from one account to another without going back to the list.
 */
export const AccountSwitcher: React.FC<{
  account: Account;
  accounts: Account[];
  onSelect: (account: Account) => void;
}> = ({ account, accounts, onSelect }) => {
  const groups = useMemo(() => {
    const open = getVisibleAccountsForAccountsPage(accounts).filter((a) => a.status !== 'closed' || a.id === account.id);
    return groupAccountsByType(open);
  }, [accounts, account.id]);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${account.name}: switch account`}
        className="group inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-violet"
      >
        <span className="min-w-0 truncate text-2xl font-semibold text-nv-ink">{account.name}</span>
        <NvIcon name="arrowDown" size={18} className="shrink-0 text-nv-muted transition-colors group-hover:text-nv-ink" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="pointer-events-auto z-popover">
          <Menu.Popup className="crystal-new max-h-[min(28rem,70vh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {groups.map((group) => (
              <Menu.Group key={group.key}>
                <Menu.GroupLabel className="px-3 pb-1 pt-2.5 text-xs font-medium text-nv-muted">{group.label}</Menu.GroupLabel>
                {group.accounts.map((a) => (
                  <Menu.Item
                    key={a.id}
                    onClick={() => a.id !== account.id && onSelect(a)}
                    className="flex min-h-11 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
                  >
                    <AccountLogo account={a} size={24} />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    {a.id === account.id && <NvIcon name="check" size={16} className="shrink-0 text-nv-muted" />}
                  </Menu.Item>
                ))}
              </Menu.Group>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

/* ── Details tab ─────────────────────────────────────────────────────────── */

const copy = (value: string, label: string) => {
  navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error(`Couldn't copy the ${label.toLowerCase()}`));
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode; copyValue?: string; mono?: boolean }> = ({
  label,
  value,
  copyValue,
  mono,
}) => (
  <div className="flex min-h-11 items-center justify-between gap-3 py-2">
    <div className="min-w-0">
      <p className="text-xs text-nv-muted">{label}</p>
      <p className={mono ? 'truncate font-mono text-sm text-nv-ink' : 'truncate text-sm font-medium text-nv-ink'}>{value}</p>
    </div>
    {copyValue && (
      <Button variant="ghost" size="sm" icon="copy" onClick={() => copy(copyValue, label)} aria-label={`Copy ${label.toLowerCase()}`}>
        Copy
      </Button>
    )}
  </div>
);

interface Connection {
  key: string;
  icon: NvIconName;
  label: string;
  name: string;
  account?: Account;
  amount?: { value: number; currency: Account['currency'] };
}

/** Everything this account is tied to: financed assets, paying accounts, settled cards and funded goals. */
const connectionsFor = (data: AccountDetailData): Connection[] => {
  const { account, accounts, linkedLoan, linkedAsset, operatingMetrics } = data;
  if (!account) return [];
  const byId = (id?: string) => (id ? accounts.find((a) => a.id === id) : undefined);
  const out: Connection[] = [];
  const add = (key: string, icon: NvIconName, label: string, target?: Account) => {
    if (target && !out.some((c) => c.account?.id === target.id)) {
      out.push({ key, icon, label, name: target.name, account: target, amount: { value: target.balance, currency: target.currency } });
    }
  };
  add('loan', 'invoice', 'Financed by', linkedLoan);
  add('asset', account.type === 'Vehicle' || linkedAsset?.type === 'Vehicle' ? 'car' : 'home', 'Finances', linkedAsset);
  const linked = byId(account.linkedAccountId);
  const linkedLabel =
    account.type === 'Investment' && account.subType === 'Spare Change'
      ? 'Round-ups from'
      : account.type === 'Loan'
        ? 'Paid from'
        : account.type === 'Lending'
          ? 'Repaid into'
          : 'Linked account';
  add('linked', 'bank', linkedLabel, linked);
  add('settlement', 'bank', 'Paid from', byId(account.settlementAccountId));
  add('lease', 'bank', 'Lease paid from', byId(account.leasePaymentAccountId));
  for (const card of operatingMetrics?.linkedCreditCards || []) add(`card-${card.id}`, 'card', 'Settles card', card);
  for (const goal of operatingMetrics?.linkedGoals || []) {
    out.push({
      key: `goal-${goal.id}`,
      icon: 'piggy',
      label: 'Funds goal',
      name: goal.name,
      amount: { value: goal.currentAmount, currency: account.currency },
    });
  }
  return out;
};

export const AccountDetailsTab: React.FC<{
  data: AccountDetailData;
  onEdit: () => void;
  onNavigateToAccount: (account: Account) => void;
  /** Opens the sell / return / retire sheet (property and vehicles). */
  onOpenCloseAsset: () => void;
  /** After a delete: leave the page, it no longer exists. */
  onDeleted: () => void;
}> = ({ data, onEdit, onNavigateToAccount, onOpenCloseAsset, onDeleted }) => {
  const { account } = data;
  const connections = useMemo(() => connectionsFor(data), [data]);
  if (!account) return null;

  const typeLabel = [account.type, account.subType || account.otherSubType].filter(Boolean).join(' · ');
  const card = account.last4
    ? `•••• ${account.last4}${account.cardNetwork ? ` · ${account.cardNetwork}` : ''}${account.expirationDate ? ` · exp ${account.expirationDate}` : ''}`
    : undefined;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-nv-ink">Identifiers</h2>
          <Button variant="secondary" size="sm" icon="edit" onClick={onEdit}>
            Edit
          </Button>
        </div>
        <div className="divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-4">
          <DetailRow label="Type" value={typeLabel} />
          <DetailRow label="Currency" value={account.currency} />
          {account.financialInstitution && <DetailRow label="Institution" value={account.financialInstitution} />}
          {account.accountNumber && (
            <DetailRow label="Account number" value={account.accountNumber} copyValue={account.accountNumber} mono />
          )}
          {account.routingNumber && (
            <DetailRow label="BIC / routing code" value={account.routingNumber} copyValue={account.routingNumber} mono />
          )}
          {card && <DetailRow label="Card" value={card} copyValue={account.last4} mono />}
          {account.cardholderName && <DetailRow label="Cardholder" value={account.cardholderName} />}
          {account.licensePlate && <DetailRow label="License plate" value={account.licensePlate} copyValue={account.licensePlate} mono />}
          {account.vin && <DetailRow label="VIN" value={account.vin} copyValue={account.vin} mono />}
          {account.address && <DetailRow label="Address" value={account.address} copyValue={account.address} />}
          {account.openingDate && <DetailRow label="Opened" value={formatShortDate(account.openingDate)} />}
          {account.purchaseDate && <DetailRow label="Purchased" value={formatShortDate(account.purchaseDate)} />}
        </div>
      </Card>

      <ManageCard data={data} onOpenCloseAsset={onOpenCloseAsset} onDeleted={onDeleted} />

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-nv-ink">Connections</h2>
        {connections.length === 0 ? (
          <p className="rounded-nv-sub bg-nv-surface p-4 text-sm text-nv-muted">No linked accounts or goals.</p>
        ) : (
          <div className="divide-y divide-nv-line rounded-nv-sub bg-nv-surface px-1">
            {connections.map((c) => {
              const body = (
                <>
                  <span className="flex min-w-0 items-center gap-3">
                    <NvIcon name={c.icon} size={18} className="shrink-0 text-nv-muted" />
                    <span className="min-w-0">
                      <span className="block text-xs text-nv-muted">{c.label}</span>
                      <span className="block truncate text-sm font-medium text-nv-ink">{c.name}</span>
                    </span>
                  </span>
                  {c.amount && <Money amount={c.amount.value} currency={c.amount.currency} />}
                </>
              );
              return c.account ? (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onNavigateToAccount(c.account!)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-nv-control px-3 py-2 text-left transition-colors hover:bg-nv-inset"
                >
                  {body}
                </button>
              ) : (
                <div key={c.key} className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Activity: open a transaction ────────────────────────────────────────── */

/**
 * The Transactions page's own detail sheet (view, edit, delete, split, recurring) for one
 * transaction of this account. Mounted only while a transaction is open, so the account page
 * doesn't build every transaction row up front.
 */
export const AccountTransactionSheet: React.FC<{ txId: string | null; onClose: () => void }> = ({ txId, onClose }) =>
  txId ? <AccountTransactionSheetInner txId={txId} onClose={onClose} /> : null;

const AccountTransactionSheetInner: React.FC<{ txId: string; onClose: () => void }> = ({ txId, onClose }) => {
  const data = useTransactionsData();
  const [splitRow, setSplitRow] = useState<TxRow | null>(null);
  const [recurringRow, setRecurringRow] = useState<TxRow | null>(null);
  const row = useMemo(() => data.rows.find((r) => r.id === txId) ?? null, [data.rows, txId]);
  return (
    <>
      <TransactionSheet
        row={splitRow || recurringRow ? null : row}
        onClose={onClose}
        data={data}
        actions={{ split: (r) => setSplitRow(r), recurring: (r) => setRecurringRow(r) }}
      />
      {splitRow && <SplitSheet row={splitRow} data={data} onClose={() => { setSplitRow(null); onClose(); }} />}
      {recurringRow && <RecurringSheet row={recurringRow} data={data} onClose={() => { setRecurringRow(null); onClose(); }} />}
    </>
  );
};

/* Archive, reopen, sell or delete (D5: permanent actions are held to confirm; the rest has Undo). */
const ManageCard: React.FC<{ data: AccountDetailData; onOpenCloseAsset: () => void; onDeleted: () => void }> = ({
  data,
  onOpenCloseAsset,
  onDeleted,
}) => {
  const { account } = data;
  if (!account) return null;
  const isClosed = account.status === 'closed';
  const isPhysical = account.type === 'Property' || account.type === 'Vehicle';
  const closure = account.closureDetails;

  const toggleArchive = () => {
    data.toggleAccountStatus(account.id);
    toast.undo(isClosed ? `Reopened ${account.name}` : `Archived ${account.name}`, () => data.toggleAccountStatus(account.id));
  };

  const reopenAsset = () => {
    if (!closure) return;
    data.revertClosure(account.id);
    toast.undo(`Reopened ${account.name}`, () => data.closeAsset(account.id, closure));
  };

  const remove = async () => {
    const ok = await confirmNew({
      title: `Delete "${account.name}" permanently?`,
      message: 'Its transactions and schedules are deleted too. Archive it instead to keep the history.',
      confirmLabel: 'Hold to delete',
      danger: true,
    });
    if (!ok) return;
    data.deleteAccount(account.id);
    toast.success(`Deleted "${account.name}"`);
    onDeleted();
  };

  return (
    <Card className="space-y-3 lg:col-span-2">
      <h2 className="text-lg font-semibold text-nv-ink">Manage</h2>
      <div className="flex flex-wrap gap-2">
        {isPhysical && isClosed && closure ? (
          <Button variant="secondary" icon="undo" onClick={reopenAsset}>
            Reopen {account.type === 'Vehicle' ? 'vehicle' : 'property'}
          </Button>
        ) : isPhysical && !isClosed ? (
          <Button variant="secondary" icon="archive" onClick={onOpenCloseAsset}>
            Sell, return or retire
          </Button>
        ) : (
          <Button variant="secondary" icon="archive" onClick={toggleArchive}>
            {isClosed ? 'Reopen account' : 'Archive account'}
          </Button>
        )}
        <Button variant="danger" icon="delete" onClick={remove}>
          Delete account
        </Button>
      </div>
    </Card>
  );
};
