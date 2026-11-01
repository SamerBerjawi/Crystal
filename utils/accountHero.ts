import { AccountType } from '../types';

// Written out in full so Tailwind finds them. Each passes AA against --on-pine in both themes.
const HERO_CLASSES: Record<AccountType, string> = {
  Checking: 'bg-pine',
  Savings: 'bg-[var(--hero-savings)]',
  Investment: 'bg-[var(--hero-investment)]',
  Property: 'bg-[var(--hero-property)]',
  Vehicle: 'bg-[var(--hero-vehicle)]',
  'Other Assets': 'bg-[var(--hero-other-assets)]',
  Lending: 'bg-[var(--hero-lending)]',
  'Credit Card': 'bg-[var(--hero-credit-card)]',
  Loan: 'bg-[var(--hero-loan)]',
  'Other Liabilities': 'bg-[var(--hero-other-liabilities)]',
};

/** Each account type has its own hero colour, so you can tell them apart at a glance (D-080). */
export const heroClassFor = (type: AccountType) => HERO_CLASSES[type] ?? HERO_CLASSES.Checking;
