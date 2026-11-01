import React, { useEffect, useMemo, useState } from 'react';
import { Transaction, Account, Tag } from '../types';
import { parseLocalDate } from '../utils';
import { getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import { getCategoryDetails } from '../utils/categories';
import { useCategoryContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useIsMobile } from '../hooks/useIsMobile';
import PlaceMap from './PlaceMap';
import { Button, HoldButton, TextLink } from './ui/Actions';
import { Badge, Row, ShowMore } from './ui/Display';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';

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
}

const fullDate = (date: string) => parseLocalDate(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const nameOf = (tx: Transaction) => tx.merchant || tx.description;

const hasPlace = (tx: Transaction) => Number.isFinite(tx.latitude) && Number.isFinite(tx.longitude);

const mapsUrl = (tx: Transaction) =>
  `https://www.google.com/maps/search/?api=1&query=${hasPlace(tx) ? `${tx.latitude},${tx.longitude}` : encodeURIComponent(tx.address || tx.placeName || tx.city || '')}`;

const placeName = (tx: Transaction) => tx.locationLabel || tx.placeName || tx.city || tx.address?.split(',')[0] || (hasPlace(tx) ? 'Pinned location' : '');

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-3 md:grid-cols-[136px_minmax(0,1fr)]">
    <dt className="type-body text-muted">{label}</dt>
    <dd className="type-body min-w-0 break-words text-ink">{children}</dd>
  </div>
);

const AccountDetail: React.FC<{ account?: Account; brandfetchClientId?: string; overrides?: Record<string, string> }> = ({ account, brandfetchClientId, overrides }) => {
  const [failed, setFailed] = useState(false);
  const line = [account?.financialInstitution, account?.last4 && `•••• ${account.last4}`].filter(Boolean).join(' · ');
  const logoUrl = useMemo(() => {
    if (!account) return null;
    return account.imageUrl || getAccountBrandfetchUrl(account, brandfetchClientId, overrides) || (account.financialInstitution ? getMerchantLogoUrl(account.financialInstitution, brandfetchClientId, overrides) : null);
  }, [account, brandfetchClientId, overrides]);

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-white shadow-xs">
        {logoUrl && !failed
          ? <img src={logoUrl} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
          : <Icon name="account_balance" size={15} className="text-muted" />}
      </span>
      <div className="min-w-0 flex-1">
        <span className="type-body-strong block truncate">{account?.name || 'Unknown account'}</span>
        {line && <span className="type-caption block truncate text-muted">{line}</span>}
      </div>
    </div>
  );
};

const TransactionDetail: React.FC<{ tx: Transaction; legs: Transaction[]; accounts: Account[]; tags: Tag[] }> = ({ tx, legs, accounts, tags }) => {
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  const logoQuery = nameOf(tx);
  const logoUrl = useMemo(() => {
    if (!logoQuery.trim()) return null;
    return getMerchantLogoUrl(logoQuery, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 96, height: 96 });
  }, [logoQuery, brandfetchClientId, logoOverrides]);
  const logo = logoUrl !== failedLogo ? logoUrl : null;

  const accountOf = (id?: string) => accounts.find(account => account.id === id);
  const from = legs.find(leg => leg.type === 'expense');
  const to = legs.find(leg => leg.type === 'income');
  const isTransfer = Boolean(tx.transferId);
  const hasBothSides = Boolean(from && to);
  const headline = isTransfer ? from || tx : tx;

  const place = placeName(tx);
  const txTags = (tx.tagIds || []).flatMap(id => tags.find(tag => tag.id === id) || []);
  const showsCategory = !isTransfer || (tx.category && tx.category !== 'Transfer');
  const categoryDetails = useMemo(() => getCategoryDetails(tx.category, allCategories), [tx.category, allCategories]);

  return (
    <div className="space-y-4">
      {hasPlace(tx) && <PlaceMap places={[{ latitude: tx.latitude!, longitude: tx.longitude! }]} label={place} logoUrl={logo} className="h-44 md:h-56" />}

      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-inset text-muted">
          {logo
            ? <img src={logo} alt="" className="size-full object-cover" onError={() => setFailedLogo(logo)} />
            : <Icon name={isTransfer ? 'swap_horiz' : 'receipt'} size={24} />}
        </span>
        <div className="min-w-0">
          <p className="type-figure-lg text-ink">
            {isTransfer
              ? <Amount value={Math.abs(headline.amount)} currency={headline.currency} />
              : <Amount value={tx.amount} currency={tx.currency} tone="flow" />}
          </p>
          {isTransfer && <Badge icon="swap_horiz">Transfer</Badge>}
        </div>
      </div>

      <dl className="divide-y divide-line border-t border-line">
        {hasBothSides ? (
          <>
            <Detail label="From"><AccountDetail account={accountOf(from!.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} /></Detail>
            <Detail label="To">
              <AccountDetail account={accountOf(to!.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} />
              {to!.currency !== from!.currency && <span className="type-caption block text-muted">Received <Amount value={to!.amount} currency={to!.currency} /></span>}
            </Detail>
          </>
        ) : (
          <Detail label="Account"><AccountDetail account={accountOf(tx.accountId)} brandfetchClientId={brandfetchClientId} overrides={logoOverrides} /></Detail>
        )}
        {showsCategory && (
          <Detail label="Category">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${categoryDetails.color || 'var(--muted)'}22`, color: categoryDetails.color || 'var(--muted)' }}>
                <Icon name={categoryDetails.icon || 'category'} size={14} />
              </span>
              <span className="font-medium text-ink">{tx.category || 'Uncategorized'}</span>
              {categoryDetails.parent && <span className="type-caption text-muted">({categoryDetails.parent})</span>}
            </span>
          </Detail>
        )}
        {tx.merchant && tx.description && tx.description !== tx.merchant && <Detail label="Description">{tx.description}</Detail>}
        {(tx.principalAmount || tx.interestAmount) ? (
          <>
            <Detail label="Principal"><Amount value={tx.principalAmount || 0} currency={tx.currency} /></Detail>
            <Detail label="Interest"><Amount value={tx.interestAmount || 0} currency={tx.currency} /></Detail>
          </>
        ) : null}
        {place && (
          <Detail label="Location">
            <span className="block">{place}</span>
            {tx.city && tx.city !== place && <span className="type-caption block text-muted">{tx.city}</span>}
            <TextLink href={mapsUrl(tx)} target="_blank" rel="noreferrer" className="type-caption mt-1 inline-flex items-center gap-1">
              Open in Google Maps
              <Icon name="open_in_new" size={16} />
            </TextLink>
          </Detail>
        )}
        {tx.notes && <Detail label="Notes"><span className="whitespace-pre-wrap">{tx.notes}</span></Detail>}
        {txTags.length > 0 && (
          <Detail label="Tags">
            <span className="flex flex-wrap gap-1.5">
              {txTags.map(tag => (
                <span key={tag.id} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-inset px-2.5 type-caption text-ink">
                  <Icon name={tag.icon || 'tag'} size={13} style={{ color: tag.color }} className="shrink-0" />
                  {tag.name}
                </span>
              ))}
            </span>
          </Detail>
        )}
      </dl>
    </div>
  );
};

/** One transaction or transfer in a 640 side panel (D-024), or a list that opens into one. */
const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, title, transactions, accounts, tags, onEdit, onDelete }) => {
  const isPhone = useIsMobile();
  const allTransactions = useTransactionSelector(all => all);
  const [picked, setPicked] = useState<Transaction | null>(null);
  const [shown, setShown] = useState(LIST_STEP);

  useEffect(() => {
    setPicked(null);
    setShown(LIST_STEP);
  }, [transactions]);

  const isTransferPair = transactions.length === 2 && !!transactions[0].transferId && transactions[0].transferId === transactions[1].transferId;
  const isList = transactions.length > 1 && !isTransferPair;
  const tx = picked || (isList ? null : transactions[0] || null);

  const legs = useMemo(() => {
    if (!tx) return [];
    if (!tx.transferId) return [tx];
    const found = allTransactions.filter(other => other.transferId === tx.transferId);
    return found.length > 0 ? found : [tx];
  }, [tx, allTransactions]);

  if (!tx && !isList) return null;

  const deleteLabel = tx?.transferId ? 'Delete transfer' : 'Delete transaction';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      width={640}
      title={tx ? nameOf(tx) : title || 'Transactions'}
      description={tx ? fullDate(tx.date) : `${transactions.length} transactions`}
      footer={tx && (onEdit || onDelete) ? (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
          {onDelete && <HoldButton block={isPhone} label={deleteLabel} onConfirm={() => onDelete(legs.map(leg => leg.id))} />}
          {onEdit && <Button block={isPhone} icon="edit" onPress={() => onEdit(tx)}>Edit</Button>}
        </div>
      ) : undefined}
    >
      {tx ? (
        <>
          {picked && <Button variant="ghost" size="sm" icon="arrow_back" className="mb-3 -ml-3" onPress={() => setPicked(null)}>All transactions</Button>}
          <TransactionDetail key={tx.id} tx={tx} legs={legs} accounts={accounts} tags={tags} />
        </>
      ) : (
        <>
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
          <ShowMore remaining={transactions.length - shown} onPress={() => setShown(count => count + LIST_STEP)} />
        </>
      )}
    </SidePanel>
  );
};

export default TransactionDetailModal;
