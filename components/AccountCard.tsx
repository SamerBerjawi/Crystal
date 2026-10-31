import React, { useMemo, useRef, useState } from 'react';
import { Account, OtherAssetSubType, OtherLiabilitySubType, Transaction } from '../types';
import { convertToEur, normalizeCurrency } from '../utils';
import { computeAccount90dSparkline, computeAccountDisplayBalance } from '../utils/accountsModel';
import { ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES, OTHER_ASSET_SUB_TYPE_STYLES, OTHER_LIABILITY_SUB_TYPE_STYLES } from '../constants';
import { useScheduleContext } from '../contexts/FinancialDataContext';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getCardNetworkLogoUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';
import { IconButton } from './ui/Actions';
import { Sparkline } from './ui/Display';
import { Menu, type MenuAction } from './ui/Menu';
import { Amount, Change } from './ui/Money';
import { cn } from '../lib/utils';

export const accountIcon = (account: Account) => {
  let style = ACCOUNT_TYPE_STYLES[account.type];
  if (account.type === 'Investment' && account.subType) style = INVESTMENT_SUB_TYPE_STYLES[account.subType];
  else if (account.type === 'Other Assets' && account.otherSubType) style = OTHER_ASSET_SUB_TYPE_STYLES[account.otherSubType as OtherAssetSubType] || style;
  else if (account.type === 'Other Liabilities' && account.otherSubType) style = OTHER_LIABILITY_SUB_TYPE_STYLES[account.otherSubType as OtherLiabilitySubType] || style;
  return account.icon || style?.icon || 'wallet';
};

const accountContext = (account: Account) => {
  if (account.type === 'Other Assets' || account.type === 'Other Liabilities') return account.otherSubType || account.type;
  if (account.type === 'Property' && account.propertyType) return account.propertyType;
  if (account.type === 'Investment' && account.subType) {
    if (account.subType === 'Pension Fund' && account.expectedRetirementYear) return `Pension, retires ${account.expectedRetirementYear}`;
    if (account.subType === 'Spare Change' && account.linkedAccountId) return 'Round-ups active';
    return account.subType;
  }
  if (account.type === 'Savings' && account.apy) return `${account.financialInstitution || 'Savings'}, ${account.apy}% APY`;
  return account.financialInstitution || account.type;
};

export const AccountLogo: React.FC<{ account: Account; size?: number }> = ({ account, size = 40 }) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const [hasFailed, setFailed] = useState(false);

  const logoUrl = useMemo(() => {
    const query = account.financialInstitution || (account as any).institutionName || (account as any).institutionId || (account as any).bankName || account.name;
    const url = query ? getMerchantLogoUrl(query, brandfetchClientId, logoOverrides, { type: 'icon', fallback: 'lettermark', width: 96, height: 96 }) : null;
    if (url) return url;
    return account.type === 'Credit Card' && account.cardNetwork ? getCardNetworkLogoUrl(account.cardNetwork, brandfetchClientId) : null;
  }, [account, brandfetchClientId, logoOverrides]);

  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-inset text-muted">
      {logoUrl && !hasFailed
        ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
        : <Icon name={accountIcon(account)} size={20} />}
    </span>
  );
};

export interface AccountCardProps {
  account: Account;
  transactions: Transaction[];
  layout: 'card' | 'row';
  isLinked?: boolean;
  menuItems: MenuAction[];
  onOpen: () => void;
  /** Drag handlers, for the manual sort order. */
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  dragState?: 'dragged' | 'over' | null;
  /** Up and down buttons, for reordering by touch. */
  reorder?: React.ReactNode;
}

/** An account as a pot: logo, name, balance and its 90-day trend. Right-click opens the same menu as the row button. */
const AccountCard: React.FC<AccountCardProps> = ({ account, transactions, layout, isLinked, menuItems, onOpen, dragProps, dragState, reorder }) => {
  const { loanPaymentOverrides } = useScheduleContext();
  const conversionRates = usePreferencesSelector(p => p.conversionRates);
  const menuRef = useRef<HTMLButtonElement>(null);

  const balance = useMemo(() => computeAccountDisplayBalance(account, transactions, loanPaymentOverrides), [account, transactions, loanPaymentOverrides]);
  const { sparklineData, trend, isPositiveTrend } = useMemo(
    () => computeAccount90dSparkline(account, transactions, balance, { conversionRates }),
    [account, transactions, balance, conversionRates]
  );
  const isForeign = normalizeCurrency(account.currency) !== 'EUR';
  const hasTrend = transactions.length > 0 && Math.abs(trend) > 0;
  const eur = convertToEur(balance, account.currency);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    menuRef.current?.click();
  };

  const badges = (
    <>
      {account.isPrimary && <Icon name="star" size={16} className="shrink-0 text-muted" aria-label="Primary account" />}
      {isLinked && <Icon name="link" size={16} className="shrink-0 text-muted" aria-label="Linked to your bank" />}
    </>
  );

  const menu = (
    <Menu
      title={account.name}
      trigger={<IconButton ref={menuRef} icon="more_horiz" label={`Actions for ${account.name}`} tooltipPlacement="left" />}
      items={menuItems}
    />
  );

  const name = (
    <button type="button" onClick={onOpen} className="block w-full min-w-0 cursor-pointer text-left after:absolute after:inset-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="type-body-strong min-w-0 truncate text-ink">{account.name}</span>
        {badges}
      </span>
      <span className="type-caption block truncate text-muted">
        {accountContext(account)}{account.last4 ? `, ending ${account.last4}` : ''}
      </span>
    </button>
  );

  const shared = {
    ...dragProps,
    onContextMenu: openMenu,
    className: cn(
      'group relative rounded-[var(--radius-xl)] border border-line bg-surface transition-colors duration-[var(--duration-fast)] hover:border-line-strong',
      dragState === 'dragged' && 'opacity-50',
      dragState === 'over' && 'border-primary',
      dragProps?.draggable && 'cursor-grab'
    ),
  };

  if (layout === 'row') {
    return (
      <div {...shared} className={cn(shared.className, 'flex min-h-16 items-center gap-3 px-3 py-2')}>
        <AccountLogo account={account} />
        <div className="min-w-0 flex-1">{name}</div>
        {hasTrend && <Sparkline data={sparklineData} isPositive={isPositiveTrend} className="max-lg:hidden" />}
        <div className="shrink-0 text-right">
          <p className="type-figure-row text-ink"><Amount value={eur} currency="EUR" /></p>
          {isForeign && <p className="type-caption text-muted"><Amount value={balance} currency={account.currency} /></p>}
        </div>
        <div className="relative z-10 flex shrink-0 items-center">{reorder}<span className="max-md:hidden">{menu}</span></div>
      </div>
    );
  }

  return (
    <div {...shared} className={cn(shared.className, 'flex min-h-[172px] flex-col justify-between gap-4 p-5')}>
      <div className="flex items-start gap-3">
        <AccountLogo account={account} />
        <div className="min-w-0 flex-1">{name}</div>
        <div className="relative z-10 -mr-2 -mt-2 flex shrink-0">{reorder}{menu}</div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-figure-lg truncate text-ink"><Amount value={eur} currency="EUR" /></p>
          {isForeign && <p className="type-caption text-muted"><Amount value={balance} currency={account.currency} /></p>}
          {hasTrend && <Change value={trend} currency="EUR" period="in 90 days" className="type-caption text-muted" />}
        </div>
        {hasTrend && <Sparkline data={sparklineData} isPositive={isPositiveTrend} width={96} height={36} />}
      </div>
    </div>
  );
};

export default AccountCard;
