import React, { useEffect, useMemo, useState } from 'react';
import { Account, Tag, Transaction } from '../types';
import { formatCurrency } from '../utils';
import {
  buildEffectiveMerchantLogoOverrides,
  getMerchantLogoUrl,
} from '../utils/brandfetch';
import { getCategoryDetails } from '../utils/categories';
import { resolveTransferInfo } from '../utils/transferDetails';
import {
  buildGroupedCategoriesForDetail,
  computeCategoryBudgetInsight,
  fullDate,
  hasPlace,
  longFormattedDate,
  nameOf,
  placeName,
  resolveSpareChangeAmount,
} from '../utils/transactionDetailModel';
import {
  CategoryBudgetMicroGauge,
  CategoryQuickPickerPill,
  TransactionFactSections,
} from './transactions/TransactionDetailParts';
import { useBudgetsContext, useCategoryContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { accountIcon } from './AccountCard';
import PlaceMap from './PlaceMap';
import { HoldButton } from './ui/Actions';
import { Badge, Row, ShowMore } from './ui/Display';
import Icon from './ui/Icon';
import { Amount, FormattedAmount, splitAmount } from './ui/Money';
import { SidePanel } from './ui/Overlays';
import { cn } from '../lib/utils';

const LIST_STEP = 50;

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Heading when several unrelated transactions are listed. */
  title?: string;
  /** One transaction, a transfer's two sides, or a list to pick from. */
  transactions: Transaction[];
  accounts: Account[];
  tags: Tag[];
  onEdit?: (transaction: Transaction) => void;
  /** Gets both sides of a transfer, so one is never left behind. */
  onDelete?: (transactionIds: string[]) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onMakeRecurring?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onRecategorize?: (transaction: Transaction, category: string) => void;
  onRemoveLocation?: (transaction: Transaction) => void;
}

const TransactionDetail: React.FC<{
  tx: Transaction;
  legs: Transaction[];
  accounts: Account[];
  tags: Tag[];
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionIds: string[]) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onMakeRecurring?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onRecategorize?: (transaction: Transaction, category: string) => void;
  onRemoveLocation?: (transaction: Transaction) => void;
}> = ({
  tx,
  legs,
  accounts,
  tags,
  onClose,
  onEdit,
  onDelete,
  onRecategorize,
}) => {
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { budgets } = useBudgetsContext();
  const allCategories = useMemo(
    () => [...incomeCategories, ...expenseCategories],
    [incomeCategories, expenseCategories]
  );
  const allTransactions = useTransactionSelector(all => all);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<
    string,
    { logo?: string }
  >;
  const logoOverrides = useMemo(
    () => buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules),
    [merchantLogoOverrides, merchantRules]
  );
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  const groupedCategories = useMemo(
    () => buildGroupedCategoriesForDetail(tx.type, incomeCategories, expenseCategories),
    [tx.type, incomeCategories, expenseCategories]
  );

  const accountOf = (id?: string) => accounts.find(account => account.id === id);
  const from = legs.find(leg => leg.type === 'expense');
  const to = legs.find(leg => leg.type === 'income');
  const isTransfer = Boolean(tx.transferId);
  const headline = isTransfer ? from || tx : tx;
  const mainAccount = accountOf(headline.accountId);

  const rawQuery =
    (tx.merchant && tx.merchant.toLowerCase() !== 'internal transfer' ? tx.merchant : '') ||
    (to ? accountOf(to.accountId)?.name : undefined) ||
    (from ? accountOf(from.accountId)?.name : undefined) ||
    tx.merchant ||
    tx.description ||
    '';
  const logoQuery = rawQuery.replace(/^Transfer\s+(to|from)\s+/i, '').trim() || nameOf(tx);
  const logoUrl = useMemo(() => {
    if (!logoQuery.trim()) return null;
    return getMerchantLogoUrl(logoQuery, brandfetchClientId, logoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 128,
      height: 128,
    });
  }, [logoQuery, brandfetchClientId, logoOverrides]);
  const logo = logoUrl !== failedLogo ? logoUrl : null;

  const place = placeName(tx);
  const txTags = (tx.tagIds || []).flatMap(id => tags.find(tag => tag.id === id) || []);
  const categoryDetails = useMemo(
    () => getCategoryDetails(tx.category, allCategories),
    [tx.category, allCategories]
  );

  const transferInfo = useMemo(() => {
    if (!isTransfer) return null;
    return resolveTransferInfo(headline, accounts, to && to.id !== headline.id ? to : from);
  }, [isTransfer, headline, accounts, to, from]);

  const navigateToAccount = (accountId?: string) => {
    if (!accountId) return;
    onClose?.();
    window.history.pushState(null, '', `/accounts/${encodeURIComponent(accountId)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const spareAmount = useMemo(
    () => resolveSpareChangeAmount(tx, allTransactions),
    [tx, allTransactions]
  );

  const parts = useMemo(() => {
    if (!tx.isSplitParent && !tx.isCombinedParent) return [];
    return allTransactions.filter(t => t.parentTransactionId === tx.id);
  }, [tx, allTransactions]);

  const catBudgetInsight = useMemo(
    () => computeCategoryBudgetInsight(tx, isTransfer, allTransactions, budgets),
    [tx, isTransfer, allTransactions, budgets]
  );

  const amountNumber = Math.abs(headline.amount);
  const isIncome = tx.type === 'income' && !isTransfer;
  const isExpense = tx.type === 'expense' && !isTransfer;
  const initial = (tx.merchant?.trim() || tx.description?.trim() || '?').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col">
      {/* 1. Map Hero Banner */}
      <div className="relative h-52 w-full overflow-hidden bg-inset sm:h-60">
        {hasPlace(tx) ? (
          <PlaceMap
            places={[{ latitude: tx.latitude!, longitude: tx.longitude! }]}
            label={place}
            logoUrl={logo}
            className="h-full w-full !rounded-none"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-black/85 via-surface/70 to-black/60">
            <Icon
              name={isTransfer ? 'arrow-data-transfer-horizontal' : 'receipt'}
              size={48}
              className="text-muted/20"
            />
          </div>
        )}

        {place && (
          <span className="absolute left-4 top-4 z-10 inline-flex h-8 max-w-[65%] items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
            <Icon name="location-01" size={16} className="shrink-0 text-primary" />
            <span className="truncate">{place}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/80"
        >
          <Icon name="cancel-01" size={16} />
        </button>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-solid to-transparent"
          aria-hidden
        />
      </div>

      {/* 2. Hero Header Content */}
      <div className="relative -mt-10 px-6">
        <div className="flex items-start justify-between gap-3">
          <span className="relative z-10 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line/40 bg-white shadow-md">
            {logo ? (
              <img
                src={logo}
                alt=""
                onError={() => setFailedLogo(logoUrl)}
                className="size-full object-cover"
              />
            ) : isTransfer ? (
              <span className="flex size-full items-center justify-center bg-blue-soft text-blue">
                <Icon name="arrow-data-transfer-horizontal" size={28} />
              </span>
            ) : mainAccount ? (
              <span className="flex size-full items-center justify-center bg-inset text-muted">
                <Icon name={accountIcon(mainAccount)} size={28} />
              </span>
            ) : (
              <span className="text-xl font-bold text-ink">{initial}</span>
            )}
          </span>

          <button
            type="button"
            aria-label="Merchant details"
            className="mt-1 flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <Icon name="info" size={20} />
          </button>
        </div>

        <div className="mt-3">
          <h3 className="break-words text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            {tx.merchant ||
              (isTransfer &&
              transferInfo &&
              (!tx.description || tx.description.toLowerCase() === 'account transfer')
                ? transferInfo.label
                : tx.description) ||
              'Transaction'}
          </h3>
          <p className="mt-1 text-sm font-medium text-muted">
            {longFormattedDate(tx.date)}
            {mainAccount && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => navigateToAccount(mainAccount.id)}
                  className="cursor-pointer font-semibold text-ink underline-offset-2 transition-colors hover:text-primary hover:underline"
                >
                  {mainAccount.name}
                </button>
              </>
            )}
          </p>
        </div>

        {(() => {
          const rawText = formatCurrency(amountNumber, headline.currency);
          const splitParts = splitAmount(rawText);
          const sign = isIncome ? '+' : isExpense ? '−' : splitParts.sign;
          const symbolTone = isTransfer ? 'text-blue' : 'text-primary';
          return (
            <div className="mt-3 flex items-baseline text-4xl font-extrabold tracking-tight md:text-5xl tabular-nums">
              {sign && <span className={cn('amount-symbol font-semibold', symbolTone)}>{sign}</span>}
              {splitParts.symbol && (
                <span className={cn('amount-symbol font-semibold', symbolTone)}>
                  {splitParts.symbol}
                </span>
              )}
              <span className="text-ink">{splitParts.integer}</span>
              {splitParts.fraction && (
                <span className="amount-fraction text-3xl md:text-4xl text-muted font-normal">
                  {splitParts.fraction}
                </span>
              )}
              {splitParts.suffix && (
                <span
                  className={cn(
                    'amount-suffix text-3xl md:text-4xl',
                    splitParts.suffix.trim() === 'BTC'
                      ? cn('amount-symbol font-semibold', symbolTone)
                      : 'text-muted'
                  )}
                >
                  {splitParts.suffix}
                </span>
              )}
            </div>
          );
        })()}

        {isTransfer && to && from && to.currency !== from.currency && (
          <p className="mt-1.5 text-sm text-muted">
            Arrives as <FormattedAmount text={formatCurrency(to.amount, to.currency)} />
          </p>
        )}

        {/* Status Chips Row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              isExpense && 'bg-tomato-soft text-tomato',
              isIncome && 'bg-money-in-soft text-money-in',
              isTransfer && 'bg-blue-soft text-blue'
            )}
          >
            <Icon
              name={
                isExpense
                  ? 'arrow-up-right-01'
                  : isIncome
                    ? 'arrow-down-left-01'
                    : 'arrow-data-transfer-horizontal'
              }
              size={14}
              className="shrink-0"
            />
            {isExpense ? 'Expense' : isIncome ? 'Income' : 'Transfer'}
          </span>

          {isTransfer && transferInfo && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: `${transferInfo.color}22`,
                color: transferInfo.color,
              }}
            >
              <Icon name={transferInfo.icon} size={16} />
              <span>{transferInfo.label}</span>
            </span>
          )}

          {!isTransfer && (
            <CategoryQuickPickerPill
              tx={tx}
              categoryDetails={categoryDetails}
              groupedCategories={groupedCategories}
              onRecategorize={onRecategorize}
            />
          )}

          {tx.isSplitParent && <Badge tone="attention">Split, {parts.length}</Badge>}
          {tx.isCombinedParent && <Badge tone="teal">Combined, {parts.length}</Badge>}
          {tx.recurringSourceId && (
            <Badge tone="positive" icon="repeat-one-01">
              Recurring
            </Badge>
          )}
          {tx.isBalanceAdjustment && <Badge tone="neutral">Adjustment</Badge>}
        </div>

        {/* 3. Category Monthly Budget Micro-Gauge */}
        {catBudgetInsight && (
          <CategoryBudgetMicroGauge
            category={tx.category}
            currency={headline.currency}
            insight={catBudgetInsight}
          />
        )}
      </div>

      {/* 4. Fact Sections */}
      <TransactionFactSections
        tx={tx}
        headline={headline}
        isTransfer={isTransfer}
        transferInfo={transferInfo}
        from={from}
        to={to}
        mainAccount={mainAccount}
        accountOf={accountOf}
        navigateToAccount={navigateToAccount}
        brandfetchClientId={brandfetchClientId}
        logoOverrides={logoOverrides}
        spareAmount={spareAmount}
        place={place}
        txTags={txTags}
        parts={parts}
        onEdit={onEdit}
      />

      {/* 5. Sticky Bottom Action Bar */}
      <div className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-solid/95 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(tx)}
              className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-canvas shadow-xs transition-opacity hover:opacity-90 md:text-base"
            >
              <Icon name="edit" size={20} />
              <span>Edit</span>
            </button>
          )}

          {onDelete && (
            <HoldButton
              label="Delete"
              staticLabel
              block={false}
              className="!h-12 !min-w-[120px] rounded-full !border-money-out/25 !bg-money-out-soft !text-money-out font-bold"
              onConfirm={() => onDelete(legs.map(l => l.id))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** One transaction or transfer in a 640 side panel, or a list that opens into one. */
const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  transactions,
  accounts,
  tags,
  onEdit,
  onDelete,
  onDuplicate,
  onMakeRecurring,
  onSplit,
  onRecategorize,
  onRemoveLocation,
}) => {
  const allTransactions = useTransactionSelector(all => all);
  const [picked, setPicked] = useState<Transaction | null>(null);
  const [shown, setShown] = useState(LIST_STEP);

  useEffect(() => {
    setPicked(null);
    setShown(LIST_STEP);
  }, [transactions]);

  const isTransferPair =
    transactions.length === 2 &&
    !!transactions[0].transferId &&
    transactions[0].transferId === transactions[1].transferId;
  const isList = transactions.length > 1 && !isTransferPair;
  const tx = picked || (isList ? null : transactions[0] || null);

  const legs = useMemo(() => {
    if (!tx) return [];
    if (!tx.transferId) return [tx];
    const found = allTransactions.filter(other => other.transferId === tx.transferId);
    return found.length > 0 ? found : [tx];
  }, [tx, allTransactions]);

  if (!tx && !isList) return null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      width={640}
      title={tx ? nameOf(tx) : title || 'Transactions'}
      description={tx ? fullDate(tx.date) : `${transactions.length} transactions`}
      hideHeader={Boolean(tx)}
      contentPadding={!tx}
    >
      {tx ? (
        <>
          {picked && (
            <div className="p-4">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Icon name="arrow_back" size={14} />
                All transactions
              </button>
            </div>
          )}
          <TransactionDetail
            key={tx.id}
            tx={tx}
            legs={legs}
            accounts={accounts}
            tags={tags}
            onClose={onClose}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMakeRecurring={onMakeRecurring}
            onSplit={onSplit}
            onRecategorize={onRecategorize}
            onRemoveLocation={onRemoveLocation}
          />
        </>
      ) : (
        <div className="p-6">
          <div className="divide-y divide-line">
            {transactions.slice(0, shown).map(item => (
              <Row
                key={item.id}
                title={nameOf(item)}
                context={fullDate(item.date)}
                trailing={<Amount value={item.amount} currency={item.currency} tone="flow" />}
                onPress={() => setPicked(item)}
              />
            ))}
          </div>
          <ShowMore
            remaining={transactions.length - shown}
            onPress={() => setShown(count => count + LIST_STEP)}
          />
        </div>
      )}
    </SidePanel>
  );
};

export default TransactionDetailModal;
