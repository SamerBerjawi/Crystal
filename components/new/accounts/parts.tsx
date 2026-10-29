import React, { useId, useMemo, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { ContextMenu } from '@base-ui/react/context-menu';
import { cn } from '../../../lib/utils';
import type { Account, AccountType, Currency } from '../../../types';
import { normalizeCurrency } from '../../../utils';
import { groupAccountsByType, type AccountSparklineResult } from '../../../utils/accountsModel';
import { AccountLogo, accountTypeIcon, LogoTile } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Card, EmptyState, IconButton, MoreButton, Money } from '../ui';

export { AccountLogo, accountTypeIcon };

/*
 * Account list primitives for `/accounts-new`:
 * - `LicensePlateNew`: EU-style vehicle registration plate badge using `nv-*` tokens
 * - `AccountSparklineSvg`: 90-day mini balance sparkline SVG
 * - `AccountRowNew`: High-density scannable balance-sheet row with action menu & reorder controls
 * - `BalanceSheetSplitView`: Side-by-side 2-column Assets vs Liabilities desktop balance sheet
 * - `AccountTableView`: Structured table view across all filtered accounts
 * - `AccountBentoGridView`: Responsive 3-column bento grid
 */

/* ── 1. LicensePlateNew (Token-Clean Vehicle Plate Badge) ──────────────── */

export const LicensePlateNew: React.FC<{
  plate: string;
  countryCode?: string;
  className?: string;
}> = ({ plate, countryCode = 'BE', className }) => (
  <span
    className={cn(
      'inline-flex h-6 items-center overflow-hidden rounded border border-nv-line bg-nv-surface text-xs font-bold tracking-wider text-nv-ink nv-tabular',
      className
    )}
  >
    <span className="flex h-full items-center justify-center bg-nv-violet px-1.5 text-xs font-bold text-nv-on-violet">
      {countryCode.slice(0, 3).toUpperCase()}
    </span>
    <span className="px-2">{plate}</span>
  </span>
);

/* ── 2. AccountSparklineSvg (90d Balance Sparkline) ────────────────────── */

export const AccountSparklineSvg: React.FC<{
  sparkline?: AccountSparklineResult;
  width?: number;
  height?: number;
  className?: string;
}> = ({ sparkline, width = 96, height = 32, className }) => {
  const gradId = useId();
  const data = sparkline?.sparklineData || [];

  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className={cn('flex items-center justify-center text-xs text-nv-faint', className)}
      >
        —
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.01, max - min);
  const pad = 3;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const linePath = pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`;
  const isPositive = sparkline?.isPositiveTrend ?? true;
  const strokeVar = isPositive ? 'var(--nv-green)' : 'var(--nv-orange)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0 overflow-visible', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeVar} stopOpacity="0.22" />
          <stop offset="100%" stopColor={strokeVar} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeVar}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ── 3. Account actions: one list for the ⋯ menu and the right-click menu (A7) ── */

interface AccountMenuEntry { key: string; label: string; icon: NvIconName; run: () => void; danger?: boolean }

const accountMenuEntries = (p: AccountItemProps): AccountMenuEntry[] => {
  const isClosed = p.account.status === 'closed';
  const entries: (AccountMenuEntry | false | undefined)[] = [
    { key: 'open', label: 'Open account', icon: 'arrowUpRight', run: () => p.onOpenDetail(p.account) },
    { key: 'peek', label: 'Quick overview', icon: 'view', run: () => p.onQuickPeek(p.account) },
    p.onFilterTransactions && { key: 'tx', label: 'Show transactions', icon: 'transactions', run: () => p.onFilterTransactions!(p.account) },
    { key: 'reconcile', label: 'Reconcile balance', icon: 'refresh', run: () => p.onAdjustBalance(p.account) },
    { key: 'edit', label: 'Edit account', icon: 'edit', run: () => p.onEdit(p.account) },
    p.onMoveUp && { key: 'up', label: 'Move up', icon: 'sort', run: p.onMoveUp },
    p.onMoveDown && { key: 'down', label: 'Move down', icon: 'sort', run: p.onMoveDown },
    { key: 'archive', label: isClosed ? 'Reopen account' : 'Archive account', icon: 'archive', run: () => p.onToggleStatus(p.account) },
    p.onDelete && { key: 'delete', label: 'Delete account', icon: 'delete', run: () => p.onDelete!(p.account), danger: true },
  ];
  return entries.filter((e): e is AccountMenuEntry => !!e);
};

const menuPopupClass = 'crystal-new min-w-52 origin-[var(--transform-origin)] rounded-nv-tile bg-nv-surface p-1.5 shadow-nv-float transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0';
const MENU_ITEM =
  'flex min-h-11 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-nv-inset';

// Opening a sheet from a menu item waits for the menu to close, so focus returns cleanly.
const runAfterClose = (run: () => void) => setTimeout(run, 50);

const AccountActionMenu: React.FC<AccountItemProps> = (props) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label={`Actions for ${props.account.name}`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-nv-muted transition-colors hover:bg-nv-inset hover:text-nv-ink"
    >
      <NvIcon name="more" size={18} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner sideOffset={6} align="end" className="pointer-events-auto z-popover">
        <Menu.Popup className={menuPopupClass}>
          {accountMenuEntries(props).map((e) => (
            <Menu.Item key={e.key} onClick={() => runAfterClose(e.run)} className={cn(MENU_ITEM, e.danger ? 'text-nv-red-text' : 'text-nv-ink')}>
              <NvIcon name={e.icon} size={16} className={e.danger ? 'text-nv-red-text' : 'text-nv-muted'} />
              {e.label}
            </Menu.Item>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
);

/* ── 4. AccountRowNew (Scannable Balance Sheet Row) ────────────────────── */

export interface AccountItemProps {
  account: Account;
  displayBalance: number;
  convertedBalance: number;
  displayCurrency: Currency;
  sparkline?: AccountSparklineResult;
  linkedLoan?: Account;
  linkedAsset?: Account;
  isLinkedBank?: boolean;
  onOpenDetail: (account: Account) => void;
  onQuickPeek: (account: Account) => void;
  onAdjustBalance: (account: Account) => void;
  onEdit: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Opens Transactions filtered to this account. */
  onFilterTransactions?: (account: Account) => void;
  /** Asks to delete the account (hold to confirm). */
  onDelete?: (account: Account) => void;
}

export const AccountRowNew: React.FC<AccountItemProps> = (props) => {
  const {
  account,
  displayBalance,
  convertedBalance,
  displayCurrency,
  sparkline,
  linkedLoan,
  linkedAsset,
  isLinkedBank,
  onOpenDetail,
  onQuickPeek,
  onAdjustBalance,
  onEdit,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
  } = props;
  const typeLabel = account.subType || account.otherSubType || account.type;
  const isClosed = account.status === 'closed';
  const isLeasedVehicle = account.type === 'Vehicle' && account.ownership === 'Leased';

  const subtitleParts = [
    account.financialInstitution,
    typeLabel,
    account.last4 ? `•••• ${account.last4}` : account.accountNumber ? `•••• ${account.accountNumber.slice(-4)}` : undefined,
    account.address,
    account.make && account.model ? `${account.make} ${account.model}` : undefined,
  ].filter(Boolean);

  // The same figure sits under the name on a phone (a right column would leave the name 60 px) and in a right column from 640px.
  const balanceBlock = isLeasedVehicle ? (
    <div>
      <span className="text-base font-semibold text-nv-ink">Leased</span>
      {account.leasePaymentAmount && (
        <p className="text-[13px] text-nv-muted">
          <Money amount={account.leasePaymentAmount} currency={account.currency} />/mo
        </p>
      )}
    </div>
  ) : (
    <>
      <Money amount={displayBalance} currency={account.currency} size="lg" />
      {normalizeCurrency(account.currency) !== normalizeCurrency(displayCurrency) && (
        <p className="text-[13px] text-nv-muted">
          ≈ <Money amount={convertedBalance} currency={displayCurrency} />
        </p>
      )}
    </>
  );

  // A8: the row is one button (click or Space: quick overview; Enter: the account page); the ⋯ menu
  // sits beside it, not inside it. Right-click opens the same actions as the ⋯ menu (A7).
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        className={cn(
          'group flex items-center gap-1 rounded-nv-sub bg-nv-surface pr-1 transition-colors hover:bg-nv-inset/60 sm:pr-2',
          isClosed && 'opacity-65'
        )}
      >
    <button
      type="button"
      onClick={() => onQuickPeek(account)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpenDetail(account);
        }
      }}
      aria-label={`${account.name}. Enter opens the account, Space the quick overview`}
      className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3 rounded-nv-sub px-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-nv-violet sm:items-center sm:px-4"
    >
      {/* Left: Logo / Icon + Name + Meta */}
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-3.5">
        <AccountLogo account={account} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-base font-semibold text-nv-ink sm:truncate">
              {account.name}
            </span>
            {account.isPrimary && (
              <span className="rounded-full bg-nv-violet-soft px-2 py-0.5 text-[11px] font-semibold text-nv-violet-text">
                Primary
              </span>
            )}
            {isLinkedBank && (
              <span className="inline-flex items-center gap-1 rounded-full bg-nv-sky-soft px-2 py-0.5 text-[11px] font-medium text-nv-sky-text">
                <NvIcon name="refresh" size={10} />
                Synced
              </span>
            )}
            {account.apy !== undefined && account.apy > 0 && (
              <span className="rounded-full bg-nv-green-soft px-2 py-0.5 text-[11px] font-semibold text-nv-green-text">
                {account.apy}% APY
              </span>
            )}
            {account.interestRate !== undefined && account.interestRate > 0 && (
              <span className="rounded-full bg-nv-orange-soft px-2 py-0.5 text-[11px] font-semibold text-nv-orange-text">
                {account.interestRate}% APR
              </span>
            )}
            {account.licensePlate && (
              <LicensePlateNew
                plate={account.licensePlate}
                countryCode={account.registrationCountryCode}
              />
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-nv-muted">
            <span className="min-w-0 break-words sm:truncate">{subtitleParts.join(' · ')}</span>
            {linkedLoan && (
              <span className="text-nv-violet-text">· Financed by {linkedLoan.name}</span>
            )}
            {linkedAsset && (
              <span className="text-nv-violet-text">· Secured on {linkedAsset.name}</span>
            )}
          </div>

          <div className="mt-1.5 sm:hidden">{balanceBlock}</div>
        </div>
      </div>

      {/* Middle: 90d Sparkline (Desktop) */}
      <div className="hidden items-center gap-3 md:flex">
        <AccountSparklineSvg sparkline={sparkline} width={88} height={28} />
        {sparkline && sparkline.trendPct !== null && Math.abs(sparkline.trendPct) >= 0.1 && (
          <span
            className={cn(
              'nv-tabular w-16 text-right text-xs font-medium',
              sparkline.isPositiveTrend ? 'text-nv-green-text' : 'text-nv-orange-text'
            )}
          >
            {sparkline.trendPct > 999
              ? '>+999%'
              : sparkline.trendPct < -999
              ? '>-999%'
              : `${sparkline.trendPct >= 0 ? '+' : ''}${sparkline.trendPct.toFixed(1)}%`}
          </span>
        )}
      </div>

      {/* Right: Balance (from 640px) + Action Menu */}
      <div className="flex items-center gap-2.5">
        <div className="hidden text-right sm:block">{balanceBlock}</div>

      </div>
    </button>
        <AccountActionMenu {...props} />
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="pointer-events-auto z-popover">
          <ContextMenu.Popup className={menuPopupClass}>
            {accountMenuEntries(props).map((e) => (
              <ContextMenu.Item key={e.key} onClick={() => runAfterClose(e.run)} className={cn(MENU_ITEM, e.danger ? 'text-nv-red-text' : 'text-nv-ink')}>
                <NvIcon name={e.icon} size={16} className={e.danger ? 'text-nv-red-text' : 'text-nv-muted'} />
                {e.label}
              </ContextMenu.Item>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

const GROUP_CAP = 8;

/* ── 5. BalanceSheetSplitView (2-Column Assets vs Liabilities View) ────── */

export const BalanceSheetSplitView: React.FC<{
  assets: Account[];
  liabilities: Account[];
  renderRow: (account: Account, idx: number, list: Account[]) => React.ReactNode;
  totalAssetsConverted: number;
  totalLiabilitiesConverted: number;
  displayCurrency: Currency;
  onAddAccount: (defaultType?: AccountType) => void;
  displayBalancesById?: Record<string, number>;
  convert?: (amount: number, from: Currency) => number;
  /** Leave out a side that has no accounts (a filtered or segmented view) instead of showing its empty state. */
  hideEmptySides?: boolean;
}> = ({
  assets,
  liabilities,
  renderRow,
  totalAssetsConverted,
  totalLiabilitiesConverted,
  displayCurrency,
  onAddAccount,
  displayBalancesById = {},
  convert,
  hideEmptySides = false,
}) => {
  // D11: a group longer than GROUP_CAP shows that many and a "Show all N" button.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const showAssets = !hideEmptySides || assets.length > 0;
  const showLiabilities = !hideEmptySides || liabilities.length > 0;
  const assetGroups = useMemo(
    () => groupAccountsByType(assets, displayBalancesById, convert, 'assets'),
    [assets, displayBalancesById, convert]
  );
  const liabilityGroups = useMemo(
    () => groupAccountsByType(liabilities, displayBalancesById, convert, 'liabilities'),
    [liabilities, displayBalancesById, convert]
  );

  return (
    <div className={cn('grid grid-cols-1 gap-5', showAssets && showLiabilities && 'xl:grid-cols-2')}>
      {/* Left Column: Assets */}
      {showAssets && (
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-nv-green" aria-hidden />
              <h2 className="text-lg font-semibold text-nv-ink">
                Assets ({assets.length})
              </h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-nv-muted">Subtotal</p>
            <Money amount={totalAssetsConverted} currency={displayCurrency} size="lg" />
          </div>
        </div>

        {assets.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No asset accounts"
            body="Add a checking account, savings reserve, property, or vehicle."
          />
        ) : (
          <div className="space-y-4">
            {assetGroups.map((group, gIdx) => (
              <div
                key={group.key}
                className={cn('space-y-2', gIdx > 0 && 'border-t border-nv-line/50 pt-3.5')}
              >
                <div className="flex items-center justify-between px-1 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-nv-ink">
                    <NvIcon name={group.icon} size={14} className="text-nv-muted" />
                    <span>{group.label}</span>
                    <span className="rounded-full bg-nv-inset px-1.5 py-0.5 text-[11px] font-normal text-nv-muted">
                      {group.accounts.length}
                    </span>
                  </div>
                  <div>
                    <Money amount={group.subtotal} currency={displayCurrency} className="text-xs font-semibold" />
                  </div>
                </div>
                <div className="space-y-2">
                  {(expandedGroups.has(group.key) ? group.accounts : group.accounts.slice(0, GROUP_CAP)).map((acc, idx) =>
                    renderRow(acc, idx, group.accounts)
                  )}
                </div>
                {group.accounts.length > GROUP_CAP && (
                  <MoreButton
                    expanded={expandedGroups.has(group.key)}
                    total={group.accounts.length}
                    onToggle={() => toggleGroup(group.key)}
                    className="mx-auto"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      )}

      {/* Right Column: Liabilities */}
      {showLiabilities && (
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-nv-orange" aria-hidden />
              <h2 className="text-lg font-semibold text-nv-ink">
                Liabilities ({liabilities.length})
              </h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-nv-muted">Subtotal</p>
            <Money amount={totalLiabilitiesConverted} currency={displayCurrency} size="lg" />
          </div>
        </div>

        {liabilities.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="Zero liabilities"
            body="You have no credit cards, loans, or debt obligations in this view."
            action={
              <button
                type="button"
                onClick={() => onAddAccount('Credit Card')}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-nv-surface px-4 text-xs font-medium text-nv-ink hover:bg-nv-inset"
              >
                <NvIcon name="add" size={14} />
                Add credit card or loan
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {liabilityGroups.map((group, gIdx) => (
              <div
                key={group.key}
                className={cn('space-y-2', gIdx > 0 && 'border-t border-nv-line/50 pt-3.5')}
              >
                <div className="flex items-center justify-between px-1 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-nv-ink">
                    <NvIcon name={group.icon} size={14} className="text-nv-muted" />
                    <span>{group.label}</span>
                    <span className="rounded-full bg-nv-inset px-1.5 py-0.5 text-[11px] font-normal text-nv-muted">
                      {group.accounts.length}
                    </span>
                  </div>
                  <div>
                    <Money amount={group.subtotal} currency={displayCurrency} className="text-xs font-semibold" />
                  </div>
                </div>
                <div className="space-y-2">
                  {(expandedGroups.has(group.key) ? group.accounts : group.accounts.slice(0, GROUP_CAP)).map((acc, idx) =>
                    renderRow(acc, idx, group.accounts)
                  )}
                </div>
                {group.accounts.length > GROUP_CAP && (
                  <MoreButton
                    expanded={expandedGroups.has(group.key)}
                    total={group.accounts.length}
                    onToggle={() => toggleGroup(group.key)}
                    className="mx-auto"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      )}
    </div>
  );
};
