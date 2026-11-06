import type { Account } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';

export interface LadderRung {
  account: Account;
  start: Date;
  maturity: Date;
  /** Whole days from today to maturity. */
  daysLeft: number;
  /** Whole days the term runs from start to maturity. */
  termDays: number;
  /** The share of the term already gone, 0 to 1. */
  elapsed: number;
  rate?: number;
  rollsOver: boolean;
}

const DAY = 86400000;

/**
 * Every open account with a maturity date still ahead, soonest first: a ladder of fixed terms. Its start is the date it
 * was opened, or today when that is unknown or after maturity.
 */
export const ladderRungs = (accounts: Account[], today = new Date()): LadderRung[] => {
  const midnight = parseLocalDate(toLocalISOString(today));
  return accounts
    .filter(account => account.status !== 'closed' && !!account.maturityDate)
    .map(account => {
      const maturity = parseLocalDate(account.maturityDate!);
      const opened = account.openingDate ? parseLocalDate(account.openingDate) : midnight;
      const start = opened.getTime() <= maturity.getTime() ? opened : midnight;
      const termDays = Math.max(1, Math.round((maturity.getTime() - start.getTime()) / DAY));
      const daysLeft = Math.round((maturity.getTime() - midnight.getTime()) / DAY);
      return {
        account,
        start,
        maturity,
        daysLeft,
        termDays,
        elapsed: Math.min(1, Math.max(0, 1 - daysLeft / termDays)),
        rate: account.apy ?? account.interestRate,
        rollsOver: !!account.rollsOver,
      };
    })
    .filter(rung => rung.daysLeft >= 0)
    .sort((a, b) => a.maturity.getTime() - b.maturity.getTime());
};
