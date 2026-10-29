import React, { useId, useMemo } from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '../../../lib/utils';
import type { Account, AccountType, Currency } from '../../../types';
import { normalizeCurrency } from '../../../utils';
import { groupAccountsByType, type AccountSparklineResult } from '../../../utils/accountsModel';
import { AccountLogo, accountTypeIcon, LogoTile } from '../EntityIcon';
import { NvIcon, type NvIconName } from '../NvIcon';
import { Badge, Card, EmptyState, IconButton, Money } from '../ui';

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

/* ── 3. Account Action Menu ────────────────────────────────────────────── */

const AccountActionMenu: React.FC<{
  account: Account;
  onQuickPeek: (account: Account) => void;
  onOpenDetail: (account: Account) => void;
  onAdjustBalance: (account: Account) => void;
  onEdit: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}> = ({
  account,
  onQuickPeek,
  onOpenDetail,
  onAdjustBalance,
  onEdit,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
}) => {
  const isClosed = account.status === 'closed';
  return (
    <Menu.Root>
      <Menu.Trigger
        onClick={(e) => e.stopPropagation()}
        aria-label={`Actions for ${account.name}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-nv-muted transition-colors hover:bg-nv-inset hover:text-nv-ink"
      >
        <NvIcon name="more" size={18} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="pointer-events-auto z-popover">
          <Menu.Popup
            onClick={(e) => e.stopPropagation()}
            className="crystal-new min-w-48 origin-[var(--transform-origin)] rounded-nv-tile bg-nv-surface p-1.5 transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <Menu.Item
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(account);
              }}
              className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name="arrowUpRight" size={16} className="text-nv-muted" />
              Open full cockpit
            </Menu.Item>
            <Menu.Item
              onClick={(e) => {
                e.stopPropagation();
                setTimeout(() => onQuickPeek(account), 50);
              }}
              className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name="view" size={16} className="text-nv-muted" />
              Quick overview
            </Menu.Item>
            <Menu.Item
              onClick={(e) => {
                e.stopPropagation();
                setTimeout(() => onAdjustBalance(account), 50);
              }}
              className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name="refresh" size={16} className="text-nv-muted" />
              Reconcile balance
            </Menu.Item>
            <Menu.Item
              onClick={(e) => {
                e.stopPropagation();
                setTimeout(() => onEdit(account), 50);
              }}
              className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name="edit" size={16} className="text-nv-muted" />
              Edit account
            </Menu.Item>
            {(onMoveUp || onMoveDown) && (
              <>
                <div className="my-1 h-px bg-nv-line" />
                {onMoveUp && (
                  <Menu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp();
                    }}
                    className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
                  >
                    <NvIcon name="sort" size={16} className="text-nv-muted" />
                    Move up in order
                  </Menu.Item>
                )}
                {onMoveDown && (
                  <Menu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown();
                    }}
                    className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
                  >
                    <NvIcon name="arrowDown" size={16} className="text-nv-muted" />
                    Move down in order
                  </Menu.Item>
                )}
              </>
            )}
            <div className="my-1 h-px bg-nv-line" />
            <Menu.Item
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(account);
              }}
              className="flex h-10 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm text-nv-ink outline-none data-[highlighted]:bg-nv-inset"
            >
              <NvIcon name="archive" size={16} className="text-nv-muted" />
              {isClosed ? 'Reopen Account' : 'Archive Account'}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

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
  onContextMenu?: (e: React.MouseEvent, account: Account) => void;
}

export const AccountRowNew: React.FC<AccountItemProps> = ({
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
  onContextMenu,
}) => {
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onQuickPeek(account)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, account);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onQuickPeek(account);
        }
      }}
      className={cn(
        'group flex items-start justify-between gap-3 rounded-nv-sub bg-nv-surface px-3 py-3.5 transition-colors sm:items-center sm:px-4 hover:bg-nv-inset/60 outline-none focus-visible:ring-2 focus-visible:ring-nv-violet cursor-pointer',
        isClosed && 'opacity-65'
      )}
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

        <AccountActionMenu
          account={account}
          onQuickPeek={onQuickPeek}
          onOpenDetail={onOpenDetail}
          onAdjustBalance={onAdjustBalance}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      </div>
    </div>
  );
};

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
                  {group.accounts.map((acc, idx) => renderRow(acc, idx, group.accounts))}
                </div>
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
                  {group.accounts.map((acc, idx) => renderRow(acc, idx, group.accounts))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}
    </div>
  );
};
