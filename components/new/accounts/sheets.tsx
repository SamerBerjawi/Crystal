import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type {
  Account,
  AssetClosureDetails,
  Currency,
  EnableBankingSyncOptions,
  Transaction,
} from '../../../types';
import type { EnableBankingLinkInfo } from '../../../contexts/DomainProviders';
import { normalizeCurrency, safeRound, toLocalISOString } from '../../../utils';
import { AmountPad } from '../../kokonutui/amount-pad';
import { confirmNew } from '../ConfirmDialog';
import { Drawer, useMediaQuery } from '../Drawer';
import { AccountLogo } from '../EntityIcon';
import { NvIcon } from '../NvIcon';
import { toast } from '../toast';
import { Badge, Button, IconButton, Money, SegmentedTabs, Switch } from '../ui';
import { currencySign } from './AccountFormSheet';

/*
 * Shared Drawers for `/accounts-new` and `/accounts-new/:id`:
 * 1. AccountOverviewSheet — Quick-peek account summary from the balance sheet list
 * 2. BalanceAdjustmentSheet — Reconcile account balance via a Balance Adjustment transaction
 * 3. ValuationSheet — Record/manage market valuations (`priceHistory`) for Property & Vehicle
 * 4. CloseAssetSheet — Dispose of a Property/Vehicle/Other Asset (Sold, Written Off, Gifted, etc.)
 * 5. EnableBankingSyncSheet — Configure & trigger Open Banking sync for a linked bank account
 */

/* ── 1. AccountOverviewSheet (Quick Peek Drawer) ────────────────────────── */

export const AccountOverviewSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  displayBalance: number;
  realTodayBalance: number;
  displayCurrency: Currency;
  convertedBalance: number;
  transactions: Transaction[];
  isLinkedBank?: boolean;
  onOpenDetail: (account: Account) => void;
  onEdit: (account: Account) => void;
  onAdjustBalance: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
  onDelete: (account: Account) => void;
}> = ({
  open,
  onOpenChange,
  account,
  displayBalance,
  realTodayBalance,
  displayCurrency,
  convertedBalance,
  transactions,
  isLinkedBank,
  onOpenDetail,
  onEdit,
  onAdjustBalance,
  onToggleStatus,
  onDelete,
}) => {
  const recentTxs = useMemo(() => {
    if (!account) return [];
    return [...transactions]
      .filter((t) => t.accountId === account.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [account, transactions]);

  if (!account) return null;

  const isClosed = account.status === 'closed';
  const typeLabel = account.subType || account.otherSubType || account.type;

  const handleConfirmDelete = async () => {
    const ok = await confirmNew({
      title: `Delete "${account.name}" permanently?`,
      message:
        'This will permanently remove the account and all of its associated transactions and schedules. To keep historical records, archive/close the account instead.',
      confirmLabel: 'Hold to delete',
      danger: true,
    });
    if (ok) {
      onDelete(account);
      onOpenChange(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={account.name}
      description={
        [account.financialInstitution, typeLabel, account.accountNumber || (account.last4 ? `•••• ${account.last4}` : undefined)]
          .filter(Boolean)
          .join(' · ')
      }
      width={480}
      footer={
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onEdit(account);
            }}
            icon="edit"
          >
            Edit
          </Button>
          <Button
            variant="cta"
            onClick={() => {
              onOpenChange(false);
              onOpenDetail(account);
            }}
            icon="arrowUpRight"
            className="flex-1"
          >
            Open Full Cockpit
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Balance Summary Panel */}
        <div className="rounded-nv-tile bg-nv-inset p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AccountLogo account={account} size={44} />
              <div>
                <p className="text-xs font-medium text-nv-muted">Current Balance</p>
                <div className="mt-0.5">
                  <Money amount={displayBalance} currency={account.currency} size="xl" />
                </div>
                {normalizeCurrency(account.currency) !== normalizeCurrency(displayCurrency) && (
                  <p className="mt-0.5 text-xs text-nv-muted">
                    ≈ <Money amount={convertedBalance} currency={displayCurrency} />
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {isClosed && (
                <Badge tone="neutral" icon="archive">
                  Archived
                </Badge>
              )}
              {isLinkedBank && (
                <Badge tone="sky" icon="refresh">
                  Bank Synced
                </Badge>
              )}
              {account.apy !== undefined && account.apy > 0 && (
                <Badge tone="green" icon="sparkles">
                  {account.apy}% APY
                </Badge>
              )}
              {account.interestRate !== undefined && account.interestRate > 0 && (
                <Badge tone="orange" icon="info">
                  {account.interestRate}% APR
                </Badge>
              )}
            </div>
          </div>

          {Math.abs(displayBalance - realTodayBalance) > 0.01 && (
            <div className="mt-3 flex items-center justify-between border-t border-nv-line pt-3 text-xs text-nv-muted">
              <span>Settled Today (Excl. Future Txs)</span>
              <Money amount={realTodayBalance} currency={account.currency} />
            </div>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onAdjustBalance(account);
            }}
            className="flex items-center gap-2.5 rounded-nv-control border border-nv-line bg-nv-surface p-3 text-left text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset"
          >
            <NvIcon name="refresh" size={18} className="text-nv-violet-text" />
            <span>Reconcile Balance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleStatus(account);
              onOpenChange(false);
            }}
            className="flex items-center gap-2.5 rounded-nv-control border border-nv-line bg-nv-surface p-3 text-left text-sm font-medium text-nv-ink transition-colors hover:bg-nv-inset"
          >
            <NvIcon name="archive" size={18} className="text-nv-muted" />
            <span>{isClosed ? 'Reopen Account' : 'Archive Account'}</span>
          </button>
        </div>

        {/* Recent Activity List */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nv-ink">Recent Ledger Activity</h3>
            <span className="text-xs text-nv-muted">{recentTxs.length} shown</span>
          </div>
          {recentTxs.length === 0 ? (
            <div className="rounded-nv-tile bg-nv-inset p-6 text-center text-sm text-nv-muted">
              No transactions recorded for this account yet.
            </div>
          ) : (
            <div className="divide-y divide-nv-line rounded-nv-tile bg-nv-inset px-4">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-nv-ink">
                      {tx.merchant || tx.description}
                    </p>
                    <p className="truncate text-xs text-nv-muted">
                      {tx.date} · {tx.category}
                    </p>
                  </div>
                  <Money
                    amount={tx.amount}
                    currency={tx.currency || account.currency}
                    signed
                    tone={tx.amount >= 0 ? 'income' : 'ink'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-medium text-nv-red-text transition-colors hover:bg-nv-red-soft"
          >
            <NvIcon name="delete" size={15} />
            <span>Permanently Delete Account</span>
          </button>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 2. BalanceAdjustmentSheet (Reconciliation Drawer) ──────────────────── */

export const BalanceAdjustmentSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onAdjust: (
    account: Account,
    targetBalance: number,
    dateStr?: string,
    note?: string
  ) => { delta: number; undo?: () => void };
}> = ({ open, onOpenChange, account, onAdjust }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [amountStr, setAmountStr] = useState('');
  const [isNegative, setIsNegative] = useState(false);
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && account) {
      setAmountStr(String(Math.abs(account.balance || 0)));
      setIsNegative(
        account.balance < 0 ||
          account.type === 'Credit Card' ||
          account.type === 'Loan' ||
          account.type === 'Other Liabilities'
      );
      setDateStr(toLocalISOString(new Date()));
      setNote('');
    }
  }, [open, account]);

  if (!account) return null;

  const rawMagnitude = parseFloat(amountStr || '0') || 0;
  const targetBalance = isNegative ? -Math.abs(rawMagnitude) : Math.abs(rawMagnitude);
  const delta = safeRound(
    targetBalance - account.balance,
    account.currency === 'BTC' ? 8 : 2
  );

  const handleConfirm = () => {
    if (Math.abs(delta) < 0.000001) {
      toast.info('Balance is already equal to the entered amount');
      onOpenChange(false);
      return;
    }
    const res = onAdjust(account, targetBalance, dateStr, note);
    if (res.undo) {
      toast.undo(
        `Reconciled ${account.name} (${delta >= 0 ? '+' : ''}${currencySign(account.currency)}${delta})`,
        res.undo
      );
    } else {
      toast.success(`Reconciled ${account.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Reconcile ${account.name}`}
      description="Enter the actual statement or bank balance. Crystal will post a reconciliation entry for the difference."
      width={460}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleConfirm}
            disabled={Math.abs(delta) < 0.000001}
            className="flex-1"
          >
            Post Adjustment
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-nv-muted">New Verified Balance</span>
            <button
              type="button"
              onClick={() => setIsNegative((v) => !v)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                isNegative
                  ? 'bg-nv-red-soft text-nv-red-text'
                  : 'bg-nv-surface text-nv-muted hover:text-nv-ink'
              )}
            >
              {isNegative ? 'Negative / Owed (−)' : 'Positive (+)'}
            </button>
          </div>
          <AmountPad
            value={amountStr}
            onChange={setAmountStr}
            currency={currencySign(account.currency)}
            keypad={phone}
            label="Target balance"
          />
        </div>

        {/* Delta Comparison Card */}
        <div className="grid grid-cols-3 gap-2 rounded-nv-tile bg-nv-inset p-4 text-center">
          <div>
            <p className="text-[11px] text-nv-muted">Current Book</p>
            <div className="mt-1">
              <Money amount={account.balance} currency={account.currency} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-nv-muted">Adjustment</p>
            <div className="mt-1">
              <Money
                amount={delta}
                currency={account.currency}
                signed
                tone={delta >= 0 ? 'income' : 'ink'}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-nv-muted">New Balance</p>
            <div className="mt-1">
              <Money amount={targetBalance} currency={account.currency} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Effective Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Reason / Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Monthly statement check"
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 3. ValuationSheet (Property & Vehicle Market Appraisal Drawer) ──────── */

export const ValuationSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onRecordValuation: (price: number, dateStr?: string) => { undo: () => void } | null;
  onDeleteValuation?: (dateStr: string) => { undo: () => void } | null;
}> = ({ open, onOpenChange, account, onRecordValuation, onDeleteValuation }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [priceStr, setPriceStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));

  useEffect(() => {
    if (open && account) {
      setPriceStr(String(Math.max(0, account.balance || 0)));
      setDateStr(toLocalISOString(new Date()));
    }
  }, [open, account]);

  if (!account) return null;

  const numPrice = parseFloat(priceStr || '0') || 0;
  const purchasePrice = account.purchasePrice || 0;
  const deltaVsPurchase = purchasePrice > 0 ? safeRound(numPrice - purchasePrice, 2) : null;
  const sortedHistory = [...(account.priceHistory || [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const handleSave = () => {
    if (numPrice <= 0) {
      toast.error('Please enter a valid market valuation');
      return;
    }
    const res = onRecordValuation(numPrice, dateStr);
    if (res?.undo) {
      toast.undo(
        `Updated ${account.name} valuation to ${currencySign(account.currency)}${numPrice.toLocaleString()}`,
        res.undo
      );
    } else {
      toast.success(`Recorded valuation for ${account.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Appraise ${account.name}`}
      description="Log a market valuation point to update net worth, equity, LTV, and historical appreciation."
      width={480}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleSave}
            disabled={numPrice <= 0}
            className="flex-1"
          >
            Save Valuation
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <p className="mb-1 text-xs font-medium text-nv-muted">Estimated Market Value</p>
          <AmountPad
            value={priceStr}
            onChange={setPriceStr}
            currency={currencySign(account.currency)}
            keypad={phone}
            label="Market valuation"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Valuation Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          {deltaVsPurchase !== null && (
            <div className="flex flex-col justify-center rounded-nv-control bg-nv-inset px-3.5 py-2">
              <span className="text-[11px] text-nv-muted">vs. Purchase Price</span>
              <Money
                amount={deltaVsPurchase}
                currency={account.currency}
                signed
                tone={deltaVsPurchase >= 0 ? 'income' : 'ink'}
              />
            </div>
          )}
        </div>

        {sortedHistory.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-nv-muted">
              Valuation History ({sortedHistory.length})
            </p>
            <div className="divide-y divide-nv-line rounded-nv-tile bg-nv-inset px-4">
              {sortedHistory.slice(0, 8).map((entry) => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="nv-tabular text-sm text-nv-ink">{entry.date}</span>
                  <div className="flex items-center gap-2">
                    <Money amount={entry.price} currency={account.currency} />
                    {onDeleteValuation && (
                      <IconButton
                        icon="delete"
                        label={`Delete valuation from ${entry.date}`}
                        size={32}
                        tone="plain"
                        onClick={() => {
                          const res = onDeleteValuation(entry.date);
                          if (res?.undo) {
                            toast.undo(`Removed valuation on ${entry.date}`, res.undo);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

/* ── 4. CloseAssetSheet (Sell / Retire Physical Asset Drawer) ────────────── */

export const CloseAssetSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accounts: Account[];
  onCloseAsset: (accountId: string, details: AssetClosureDetails) => void;
}> = ({ open, onOpenChange, account, accounts, onCloseAsset }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [closureType, setClosureType] =
    useState<AssetClosureDetails['closureType']>('Sold');
  const [valueStr, setValueStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toLocalISOString(new Date()));
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [notes, setNotes] = useState('');

  const depositAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.id !== account?.id &&
          a.status !== 'closed' &&
          (a.type === 'Checking' || a.type === 'Savings')
      ),
    [accounts, account?.id]
  );

  useEffect(() => {
    if (open && account) {
      setClosureType(account.ownership === 'Leased' ? 'Returned' : 'Sold');
      setValueStr(String(Math.max(0, account.balance || 0)));
      setDateStr(toLocalISOString(new Date()));
      setIncomeAccountId(depositAccounts[0]?.id || '');
      setNotes('');
    }
  }, [open, account, depositAccounts]);

  if (!account) return null;

  const numValue = parseFloat(valueStr || '0') || 0;

  const handleConfirm = () => {
    onCloseAsset(account.id, {
      closureType,
      date: dateStr,
      value: closureType === 'Sold' ? numValue : 0,
      incomeAccountId: closureType === 'Sold' && incomeAccountId ? incomeAccountId : undefined,
      notes: notes.trim() || undefined,
    });
    toast.success(`Closed "${account.name}" as ${closureType}`);
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Close or Sell ${account.name}`}
      description="Mark this asset as sold, returned, or retired. If sold, proceeds can be deposited directly into a bank account."
      width={480}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button variant="cta" onClick={handleConfirm} className="flex-1">
            Confirm Disposition
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-nv-muted">
            Disposition Reason
          </label>
          <SegmentedTabs<AssetClosureDetails['closureType']>
            label="Disposition Type"
            size="sm"
            className="w-full"
            value={closureType}
            onChange={setClosureType}
            items={[
              { id: 'Sold', label: 'Sold' },
              { id: 'Returned', label: 'Returned' },
              { id: 'Written Off', label: 'Written Off' },
              { id: 'Retired', label: 'Retired' },
            ]}
          />
        </div>

        {closureType === 'Sold' && (
          <>
            <div className="rounded-nv-tile bg-nv-inset p-4">
              <p className="mb-1 text-xs font-medium text-nv-muted">Net Sale Proceeds</p>
              <AmountPad
                value={valueStr}
                onChange={setValueStr}
                currency={currencySign(account.currency)}
                keypad={phone}
                label="Sale proceeds"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-nv-muted">
                Deposit Proceeds Into
              </label>
              <select
                value={incomeAccountId}
                onChange={(e) => setIncomeAccountId(e.target.value)}
                className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
              >
                <option value="">Do not create a deposit transaction</option>
                {depositAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Disposition Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Buyer or contract reference"
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 5. EnableBankingSyncSheet (Open Banking Sync Drawer) ────────────────── */

export const EnableBankingSyncSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  linkInfo?: EnableBankingLinkInfo;
  onTriggerSync: (options: EnableBankingSyncOptions) => Promise<void>;
}> = ({ open, onOpenChange, account, linkInfo, onTriggerSync }) => {
  const [mode, setMode] =
    useState<NonNullable<EnableBankingSyncOptions['transactionMode']>>('incremental');
  const [updateBalance, setUpdateBalance] = useState(true);
  const [syncStartDate, setSyncStartDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (open && linkInfo) {
      setMode('incremental');
      setUpdateBalance(true);
      setSyncStartDate(linkInfo.account.syncStartDate || '');
    }
  }, [open, linkInfo]);

  if (!account || !linkInfo) return null;

  const handleRunSync = async () => {
    setIsSyncing(true);
    try {
      await onTriggerSync({
        transactionMode: mode,
        updateBalance,
        syncStartDate: mode === 'full' && syncStartDate ? syncStartDate : undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Bank Sync · ${account.name}`}
      description={`Connected to ${linkInfo.connection.selectedBank || linkInfo.account.bankName}`}
      width={460}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            icon="refresh"
            disabled={isSyncing}
            onClick={handleRunSync}
            className="flex-1"
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-nv-tile bg-nv-inset p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-nv-ink">
                {linkInfo.connection.selectedBank || linkInfo.account.bankName}
              </p>
              <p className="text-xs text-nv-muted">
                Last synced: {linkInfo.account.lastSyncedAt || linkInfo.connection.lastSyncedAt || 'Never'}
              </p>
            </div>
            <Badge
              tone={linkInfo.connection.status === 'ready' ? 'green' : 'orange'}
              icon={linkInfo.connection.status === 'ready' ? 'checkCircle' : 'warning'}
            >
              {linkInfo.connection.status === 'ready' ? 'Connected' : 'Needs Review'}
            </Badge>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-nv-muted">
            Transaction Fetch Scope
          </label>
          <SegmentedTabs<NonNullable<EnableBankingSyncOptions['transactionMode']>>
            label="Transaction Sync Mode"
            size="sm"
            className="w-full"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'incremental', label: 'New Since Last Sync' },
              { id: 'full', label: 'Full History' },
              { id: 'none', label: 'Balance Only' },
            ]}
          />
        </div>

        {mode === 'full' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-nv-muted">
              Fetch History From Date
            </label>
            <input
              type="date"
              value={syncStartDate}
              onChange={(e) => setSyncStartDate(e.target.value)}
              className="h-11 w-full rounded-nv-control border border-nv-line bg-nv-surface px-3.5 text-sm text-nv-ink outline-none focus:border-nv-violet"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-nv-tile bg-nv-inset p-4">
          <div>
            <p className="text-sm font-medium text-nv-ink">Update Account Balance</p>
            <p className="text-xs text-nv-muted">
              Overwrite local book balance with the bank’s closing booked balance
            </p>
          </div>
          <Switch
            checked={updateBalance}
            onChange={setUpdateBalance}
            label="Update account balance from bank"
          />
        </div>
      </div>
    </Drawer>
  );
};
