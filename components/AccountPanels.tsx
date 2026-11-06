import React from 'react';
import { isMealVoucherAccount } from '../utils/accountsModel';
import { CheckingLayout, MealVoucherLayout, SavingsLayout } from './accounts/CashLayouts';
import { CreditCardLayout } from './accounts/CreditCardLayout';
import { LiabilityLayout, LoanLayout } from './accounts/DebtLayouts';
import { OtherAssetLayout, PropertyLayout, VehicleLayout } from './accounts/AssetLayouts';
import { InvestmentLayout, PensionLayout, SpareChangeLayout, WarrantLayout } from './accounts/InvestmentLayouts';
import type { AccountPanelProps } from './accounts/pageKit';

export type { AccountPanelProps } from './accounts/pageKit';

/**
 * Picks the page layout for an account's type (docs/redesign/12-account-pages.md). Each type has its own layout
 * inside a shared shell: header, hero with key figures, the Connections strip, then tabs.
 */
const AccountPanels: React.FC<AccountPanelProps & { onOpenInvestments?: () => void }> = props => {
  const { account } = props;
  if (isMealVoucherAccount(account)) return <MealVoucherLayout {...props} />;
  switch (account.type) {
    case 'Checking': return <CheckingLayout {...props} />;
    case 'Savings': return <SavingsLayout {...props} />;
    case 'Credit Card': return <CreditCardLayout {...props} />;
    case 'Loan':
    case 'Lending': return <LoanLayout {...props} />;
    case 'Other Liabilities': return <LiabilityLayout {...props} />;
    case 'Property': return <PropertyLayout {...props} />;
    case 'Vehicle': return <VehicleLayout {...props} />;
    case 'Other Assets':
      return account.otherSubType === 'Cash' ? <CheckingLayout {...props} /> : <OtherAssetLayout {...props} />;
    case 'Investment':
      if (account.subType === 'Pension Fund') return <PensionLayout {...props} />;
      if (account.subType === 'Spare Change') return <SpareChangeLayout {...props} />;
      if (account.subType === 'Warrant') return <WarrantLayout {...props} />;
      return <InvestmentLayout {...props} />;
    default: return <CheckingLayout {...props} />;
  }
};

export default AccountPanels;
