import type { EnableBankingAccount } from '../types';

/*
 * What a bank shares through open banking (PSD2). A bank only exposes the accounts its PSD2 interface covers, so some
 * products never appear in the account list however the connection is set up. Source: Enable Banking market docs
 * (https://enablebanking.com/docs/markets/be/).
 */

interface CoverageLimit {
  /** Matches the bank name as Enable Banking lists it. */
  bank: RegExp;
  missing: 'Credit Card' | 'Savings';
  note: string;
}

const LIMITS: CoverageLimit[] = [
  {
    bank: /\b(kbc|cbc)\b/i,
    missing: 'Credit Card',
    note: 'KBC, KBC Brussels and CBC don’t share credit card accounts through open banking, so cards can’t be synced. Add the card as a Crystal account and enter or import its transactions.',
  },
];

/** A note for the connection card when a product the bank is known not to share is absent from its accounts. */
export function getBankCoverageNote(bankName: string | undefined, accounts: Pick<EnableBankingAccount, 'cashAccountType'>[]): string | null {
  if (!bankName) return null;
  const limit = LIMITS.find(item => item.bank.test(bankName));
  if (!limit) return null;
  const hasCard = accounts.some(account => account.cashAccountType === 'CARD');
  return limit.missing === 'Credit Card' && hasCard ? null : limit.note;
}

const KIND_LABELS: Record<string, string> = { SVGS: 'Savings', CARD: 'Card', LOAN: 'Loan' };

/** Short badge text for accounts that aren't an ordinary current account; undefined for those. */
export function accountKindLabel(cashAccountType: string | undefined): string | undefined {
  return cashAccountType ? KIND_LABELS[cashAccountType.toUpperCase()] : undefined;
}
