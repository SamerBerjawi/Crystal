import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Account, Tag, Transaction } from '../../types';
import { formatCurrency } from '../../utils';
import {
  getAccountBrandfetchUrl,
  getMerchantLogoUrl,
  isCashAccount,
} from '../../utils/brandfetch';
import { TransferInfo } from '../../utils/transferDetails';
import {
  DetailCategoryGroup,
  filterCategoryGroupsForDetail,
  hasPlace,
  mapsUrl,
} from '../../utils/transactionDetailModel';
import Icon from '../ui/Icon';
import { FormattedAmount } from '../ui/Money';
import { cn } from '../../lib/utils';

export const AccountLogoTile: React.FC<{
  account?: Account;
  brandfetchClientId?: string;
  overrides?: Record<string, string>;
}> = ({ account, brandfetchClientId, overrides }) => {
  const [failed, setFailed] = useState(false);
  const logoUrl = useMemo(() => {
    if (!account || isCashAccount(account)) return null;
    return (
      account.imageUrl ||
      getAccountBrandfetchUrl(account, brandfetchClientId, overrides) ||
      (account.financialInstitution
        ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, overrides)
        : null)
    );
  }, [account, brandfetchClientId, overrides]);

  const initial = account?.name?.trim().charAt(0).toUpperCase();

  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-inset shadow-xs border border-line">
      {logoUrl && !failed ? (
        <img src={logoUrl} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : initial ? (
        <span className="text-sm font-bold text-ink">{initial}</span>
      ) : (
        <Icon name="bank" size={18} className="text-muted" />
      )}
    </span>
  );
};

export const FactSection: React.FC<{
  label: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, icon, action, children, className }) => (
  <section className={cn('min-w-0', className)}>
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-muted">
        {icon && <Icon name={icon} size={16} className="text-muted" aria-hidden />}
        <span>{label}</span>
      </h4>
      {action}
    </div>
    {children}
  </section>
);

export const CategoryQuickPickerPill: React.FC<{
  tx: Transaction;
  categoryDetails: { icon?: string; color?: string; parent?: string };
  groupedCategories: DetailCategoryGroup[];
  onRecategorize?: (transaction: Transaction, category: string) => void;
}> = ({ tx, categoryDetails, groupedCategories, onRecategorize }) => {
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const catPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
        setCatSearch('');
      }
    };
    if (catPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [catPickerOpen]);

  const filteredCatGroups = useMemo(
    () => filterCategoryGroupsForDetail(groupedCategories, catSearch),
    [groupedCategories, catSearch]
  );

  return (
    <div className="relative inline-block" ref={catPickerRef}>
      <button
        type="button"
        onClick={() => setCatPickerOpen(o => !o)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:ring-1 hover:ring-line-strong"
        style={{
          backgroundColor: `${categoryDetails.color || 'var(--muted)'}22`,
          color: categoryDetails.color || 'var(--muted)',
        }}
      >
        <Icon name={categoryDetails.icon || 'category'} size={16} />
        <span>{tx.category || 'Uncategorized'}</span>
        {categoryDetails.parent && <span className="opacity-70">· {categoryDetails.parent}</span>}
        <Icon
          name="expand_more"
          size={16}
          className={cn('transition-transform', catPickerOpen && 'rotate-180')}
        />
      </button>

      {catPickerOpen && onRecategorize && (
        <div
          className="absolute left-0 top-full z-[var(--z-popover)] mt-1.5 flex max-h-80 w-72 flex-col overflow-hidden rounded-2xl border border-line bg-solid shadow-2xl"
          style={{ backgroundColor: 'var(--solid)' }}
        >
          <div className="border-b border-line p-2" style={{ backgroundColor: 'var(--solid)' }}>
            <div className="flex items-center gap-2 rounded-xl bg-inset px-2.5 py-1.5 text-xs text-ink">
              <Icon name="search" size={14} className="shrink-0 text-muted" />
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
                autoFocus
              />
              {catSearch && (
                <button
                  type="button"
                  onClick={() => setCatSearch('')}
                  className="cursor-pointer text-muted hover:text-ink"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>
          </div>

          <div
            className="max-h-64 overflow-y-auto p-1.5 space-y-1"
            style={{ backgroundColor: 'var(--solid)' }}
          >
            {filteredCatGroups.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted">No categories found</div>
            ) : (
              filteredCatGroups.map(group => (
                <div key={group.name} className="space-y-0.5">
                  <div
                    className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line/40 px-2.5 pt-2 pb-1 type-caption font-bold uppercase tracking-wider text-muted select-none"
                    style={{ backgroundColor: 'var(--solid)' }}
                  >
                    {group.icon && (
                      <Icon
                        name={group.icon}
                        size={13}
                        style={{ color: group.color }}
                        className="shrink-0"
                      />
                    )}
                    <span>{group.name}</span>
                  </div>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onRecategorize(tx, item.id);
                        setCatPickerOpen(false);
                        setCatSearch('');
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                        item.level === 1 ? 'pl-6' : 'pl-2.5',
                        tx.category === item.id
                          ? 'bg-primary-soft font-semibold text-primary'
                          : 'text-ink hover:bg-inset'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon
                          name={item.icon || 'category'}
                          size={16}
                          style={{ color: item.color }}
                          className="shrink-0"
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {tx.category === item.id && (
                        <Icon name="check" size={14} className="shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CategoryBudgetMicroGauge: React.FC<{
  category?: string;
  currency: Transaction['currency'];
  insight: { spent: number; limit: number; pct: number };
}> = ({ category, currency, insight }) => (
  <div className="mt-4 rounded-2xl border border-line/60 bg-inset p-3.5 space-y-2">
    <div className="flex items-center justify-between text-xs font-medium text-muted">
      <span>{category} monthly budget</span>
      <span className="font-bold text-ink">
        <FormattedAmount text={formatCurrency(insight.spent, currency, { compact: true })} /> (
        {insight.pct}%)
      </span>
    </div>
    <div className="flex items-center gap-[3px] w-full h-2">
      {Array.from({ length: 40 }).map((_, i) => {
        const activeCount = Math.round((insight.pct / 100) * 40);
        const isActive = i < activeCount;
        return (
          <span
            key={i}
            className={cn(
              'h-full flex-1 rounded-full transition-colors',
              isActive ? 'bg-amber' : 'bg-primary/30'
            )}
          />
        );
      })}
    </div>
  </div>
);

export const TransactionFactSections: React.FC<{
  tx: Transaction;
  headline: Transaction;
  isTransfer: boolean;
  transferInfo: TransferInfo | null;
  from?: Transaction;
  to?: Transaction;
  mainAccount?: Account;
  accountOf: (id?: string) => Account | undefined;
  navigateToAccount: (accountId?: string) => void;
  brandfetchClientId: string;
  logoOverrides: Record<string, string>;
  spareAmount: number;
  place: string;
  txTags: Tag[];
  parts: Transaction[];
  onEdit?: (transaction: Transaction) => void;
}> = ({
  tx,
  headline,
  isTransfer,
  transferInfo,
  from,
  to,
  mainAccount,
  accountOf,
  navigateToAccount,
  brandfetchClientId,
  logoOverrides,
  spareAmount,
  place,
  txTags,
  parts,
  onEdit,
}) => (
  <div className="mt-6 space-y-6 px-6 pb-6">
    {/* Payment & Account Section */}
    {isTransfer ? (
      <div className="space-y-2">
        {transferInfo && (
          <div
            className="flex items-center gap-1.5 px-1 text-xs font-semibold"
            style={{ color: transferInfo.color }}
          >
            <Icon name={transferInfo.icon} size={16} />
            <span>{transferInfo.label}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FactSection label="From" icon="bank">
            {from?.accountId ? (
              <button
                type="button"
                onClick={() => navigateToAccount(from.accountId)}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
              >
                <AccountLogoTile
                  account={accountOf(from.accountId)}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary">
                    {accountOf(from.accountId)?.name || 'Unknown'}
                  </p>
                  {accountOf(from.accountId)?.type && (
                    <p className="truncate text-xs text-muted capitalize">
                      {accountOf(from.accountId)?.type}
                    </p>
                  )}
                </div>
                <Icon
                  name="chevron_right"
                  size={16}
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </button>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl bg-inset p-3">
                <AccountLogoTile
                  account={accountOf(from?.accountId)}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {accountOf(from?.accountId)?.name || 'Unknown'}
                  </p>
                  {accountOf(from?.accountId)?.type && (
                    <p className="truncate text-xs text-muted capitalize">
                      {accountOf(from?.accountId)?.type}
                    </p>
                  )}
                </div>
              </div>
            )}
          </FactSection>
          <FactSection label="To" icon="bank">
            {to?.accountId ? (
              <button
                type="button"
                onClick={() => navigateToAccount(to.accountId)}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
              >
                <AccountLogoTile
                  account={accountOf(to.accountId)}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary">
                    {accountOf(to.accountId)?.name || 'Unknown'}
                  </p>
                  {accountOf(to.accountId)?.type && (
                    <p className="truncate text-xs text-muted capitalize">
                      {accountOf(to.accountId)?.type}
                    </p>
                  )}
                </div>
                <Icon
                  name="chevron_right"
                  size={16}
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </button>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl bg-inset p-3">
                <AccountLogoTile
                  account={accountOf(to?.accountId)}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {accountOf(to?.accountId)?.name || 'Unknown'}
                  </p>
                  {accountOf(to?.accountId)?.type && (
                    <p className="truncate text-xs text-muted capitalize">
                      {accountOf(to?.accountId)?.type}
                    </p>
                  )}
                </div>
              </div>
            )}
          </FactSection>
        </div>
      </div>
    ) : (
      <FactSection label="Payment & Account" icon="bank">
        <div className="space-y-2.5">
          {mainAccount ? (
            <button
              type="button"
              onClick={() => navigateToAccount(mainAccount.id)}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl bg-inset p-3 text-left transition-colors hover:bg-surface"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AccountLogoTile
                  account={mainAccount}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-primary md:text-base">
                  {mainAccount.name}
                  {mainAccount.last4 && (
                    <span className="ml-1.5 font-normal text-muted">(•••• {mainAccount.last4})</span>
                  )}
                </p>
              </div>
              {mainAccount.type && (
                <span className="shrink-0 text-sm font-normal capitalize text-muted">
                  {mainAccount.type}
                </span>
              )}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-inset p-3">
              <div className="flex min-w-0 items-center gap-3">
                <AccountLogoTile
                  account={mainAccount}
                  brandfetchClientId={brandfetchClientId}
                  overrides={logoOverrides}
                />
                <p className="truncate text-sm font-semibold text-ink md:text-base">
                  {mainAccount?.name || 'Unknown account'}
                </p>
              </div>
            </div>
          )}

          {spareAmount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-inset p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-money-in-soft text-money-in">
                  <Icon name="piggy-bank" size={20} />
                </span>
                <p className="truncate text-sm font-semibold text-ink">Spare Change Round-up</p>
              </div>
              <span className="type-figure-row shrink-0 text-money-in">
                +<FormattedAmount text={formatCurrency(spareAmount, headline.currency)} />
              </span>
            </div>
          )}
        </div>
      </FactSection>
    )}

    {/* Description Section */}
    {tx.description && (
      <FactSection label="Description" icon="calendar-03">
        <p className="break-words text-base font-semibold text-ink">{tx.description}</p>
      </FactSection>
    )}

    {/* Memo / Notes Section */}
    {tx.notes && (
      <FactSection label="Notes" icon="doc-01">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {tx.notes}
        </p>
      </FactSection>
    )}

    {/* Location Section */}
    {(place || tx.address || hasPlace(tx)) && (
      <FactSection
        label="Location"
        icon="location-01"
        action={
          <a
            href={mapsUrl(tx)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Open in Maps
            <Icon name="link-square-02" size={14} />
          </a>
        }
      >
        <address className="not-italic space-y-1 text-sm leading-relaxed text-ink/90">
          {place && <p className="font-bold text-base text-ink">{place}</p>}
          {tx.street && <p>{tx.street}</p>}
          {tx.address && !tx.street && tx.address !== place && <p>{tx.address}</p>}
          {[tx.postalCode, tx.city].filter(Boolean).length > 0 && (
            <p>{[tx.postalCode, tx.city].filter(Boolean).join(' ')}</p>
          )}
          {tx.state && <p>{tx.state}</p>}
          {tx.country && <p>{tx.country}</p>}
        </address>
      </FactSection>
    )}

    {/* Loan Split Pills */}
    {tx.principalAmount || tx.interestAmount ? (
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3.5 py-1.5 text-xs font-semibold text-ink">
          <Icon name="bank" size={14} className="shrink-0 text-muted" />
          Principal <FormattedAmount text={formatCurrency(tx.principalAmount || 0, tx.currency)} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3.5 py-1.5 text-xs font-semibold text-ink">
          <Icon name="coins-01" size={14} className="shrink-0 text-muted" />
          Interest <FormattedAmount text={formatCurrency(tx.interestAmount || 0, tx.currency)} />
        </span>
      </div>
    ) : null}

    {/* Tags Section */}
    <FactSection label="Tags" icon="tag-01">
      <div className="flex flex-wrap items-center gap-2">
        {txTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-inset px-3 text-xs font-semibold text-ink"
          >
            <Icon name={tag.icon || 'tag'} size={14} style={{ color: tag.color }} className="shrink-0" />
            {tag.name}
          </span>
        ))}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(tx)}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink transition-colors"
          >
            <Icon name="add" size={16} />
            Add tag
          </button>
        )}
      </div>
    </FactSection>

    {/* Split Parts List */}
    {parts.length > 0 && (
      <FactSection
        label={
          tx.isSplitParent
            ? `Split into ${parts.length} parts`
            : `Combines ${parts.length} transactions`
        }
      >
        <ul className="space-y-2 rounded-2xl bg-inset p-3">
          {parts.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                {p.description || p.merchant || p.category}
              </span>
              <span className="text-xs text-muted">{p.category}</span>
              <span className="font-semibold text-ink">
                <FormattedAmount text={formatCurrency(Math.abs(p.amount), p.currency)} />
              </span>
            </li>
          ))}
        </ul>
      </FactSection>
    )}
  </div>
);
