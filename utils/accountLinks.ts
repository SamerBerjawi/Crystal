import type { Account, FinancialGoal, RecurringTransaction, Transaction } from '../types';

/**
 * How accounts point at each other (docs/redesign/12-account-pages.md). Every link is read from what is already
 * stored, so both pages show it without saving it twice. The loan's `linkedAssetId` is the only loan-to-asset link:
 * the asset side is derived, and an old `linkedLoanId` is folded into the loan on load.
 */

export type LinkKind =
  | 'pays-from'        // a card or loan is paid from this account
  | 'settles'          // this account pays a card
  | 'pays-loan'        // this account pays a loan
  | 'secured-by'       // a loan is secured by an asset
  | 'secures'          // an asset secures a loan
  | 'lease-from'       // a leased vehicle is paid from this account
  | 'pays-lease'       // this account pays a lease
  | 'rounds-up-from'   // spare change takes round-ups from this account
  | 'rounds-up-to'     // this account's round-ups go to a spare change account
  | 'sold-into'        // a closed asset's sale went into this account
  | 'received-sale'    // this account received an asset's sale
  | 'funds-goal'       // contributions to a goal leave this account
  | 'holds-goal'       // a goal's money sits in this account
  | 'transfers-with';  // money often moves between the two (derived from transfers)

export interface AccountLink {
  kind: LinkKind;
  /** A short phrase that reads before the name: "Pays from", "Secures". */
  label: string;
  target: { type: 'account'; account: Account } | { type: 'goal'; goal: FinancialGoal };
  /** For derived transfer links: how many transfers in the period. */
  count?: number;
}

const isAsset = (account: Account) => account.type === 'Property' || account.type === 'Vehicle';
const isLoanLike = (account: Account) => account.type === 'Loan';

/** The loans secured by an asset. The loan's own field decides; a legacy `linkedLoanId` is the fallback. */
export function loansForAsset(asset: Account, accounts: Account[]): Account[] {
  const direct = accounts.filter(item => isLoanLike(item) && item.linkedAssetId === asset.id);
  if (direct.length) return direct;
  const legacy = asset.linkedLoanId ? accounts.find(item => item.id === asset.linkedLoanId && isLoanLike(item) && !item.linkedAssetId) : undefined;
  return legacy ? [legacy] : [];
}

export function assetForLoan(loan: Account, accounts: Account[]): Account | undefined {
  if (loan.linkedAssetId) {
    const direct = accounts.find(item => item.id === loan.linkedAssetId && isAsset(item));
    if (direct) return direct;
  }
  return accounts.find(item => isAsset(item) && item.linkedLoanId === loan.id);
}

/**
 * Folds every asset's `linkedLoanId` into its loan's `linkedAssetId` and removes the old field. A loan that already
 * points somewhere keeps its own link. Returns the same array when nothing changes, so it is cheap to run on load.
 */
export function normalizeLoanAssetLinks(accounts: Account[]): Account[] {
  if (!accounts.some(item => item.linkedLoanId !== undefined)) return accounts;
  const claims = new Map<string, string>();
  accounts.forEach(item => {
    if (isAsset(item) && item.linkedLoanId) claims.set(item.linkedLoanId, item.id);
  });
  return accounts.map(item => {
    let next = item;
    if (isLoanLike(item) && !item.linkedAssetId && claims.has(item.id)) next = { ...next, linkedAssetId: claims.get(item.id) };
    if (next.linkedLoanId !== undefined) {
      const { linkedLoanId: _dropped, ...rest } = next;
      next = rest as Account;
    }
    return next;
  });
}

/**
 * Applies an asset form's mortgage choice. The form still offers one picker on a property; its choice is written
 * to the loan, and any other loan that pointed at the asset lets go.
 */
export function applyAssetLoanChoice(accounts: Account[], assetId: string, loanId: string | undefined): Account[] {
  return accounts.map(item => {
    if (!isLoanLike(item)) return item;
    if (loanId && item.id === loanId) return item.linkedAssetId === assetId ? item : { ...item, linkedAssetId: assetId };
    if (item.linkedAssetId === assetId) return { ...item, linkedAssetId: undefined };
    return item;
  });
}

const accountLink = (kind: LinkKind, label: string, account: Account, count?: number): AccountLink => ({ kind, label, target: { type: 'account', account }, count });

export interface LinkContext {
  accounts: Account[];
  goals?: FinancialGoal[];
  transactions?: Transaction[];
  /** Transfers on or after this day count towards "often moves". Defaults to 180 days before `today`. */
  since?: string;
  today?: Date;
}

/** Every account and goal this account is linked to, stored links first, then frequent transfer partners. */
export function accountLinks(account: Account, ctx: LinkContext): AccountLink[] {
  const { accounts, goals = [], transactions = [] } = ctx;
  const byId = new Map(accounts.map(item => [item.id, item]));
  const links: AccountLink[] = [];
  const seen = new Set<string>();
  const push = (link: AccountLink) => {
    const key = `${link.kind}:${link.target.type === 'account' ? link.target.account.id : link.target.goal.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  };
  const others = accounts.filter(item => item.id !== account.id);

  // What this account points at.
  const settlement = account.settlementAccountId ? byId.get(account.settlementAccountId) : undefined;
  if (settlement && account.type === 'Credit Card') push(accountLink('pays-from', 'Pays from', settlement));
  const linked = account.linkedAccountId ? byId.get(account.linkedAccountId) : undefined;
  if (linked) {
    if (account.type === 'Loan') push(accountLink('pays-from', 'Paid from', linked));
    else if (account.type === 'Lending') push(accountLink('pays-from', 'Repaid into', linked));
    else if (account.subType === 'Spare Change') push(accountLink('rounds-up-from', 'Round-ups from', linked));
  }
  if (isLoanLike(account)) {
    const asset = assetForLoan(account, accounts);
    if (asset) push(accountLink('secured-by', 'Secured by', asset));
  }
  if (isAsset(account)) loansForAsset(account, accounts).forEach(loan => push(accountLink('secures', account.type === 'Property' ? 'Mortgage' : 'Car loan', loan)));
  const leaseFrom = account.leasePaymentAccountId ? byId.get(account.leasePaymentAccountId) : undefined;
  if (leaseFrom && account.type === 'Vehicle') push(accountLink('lease-from', 'Lease paid from', leaseFrom));
  const soldInto = account.closureDetails?.incomeAccountId ? byId.get(account.closureDetails.incomeAccountId) : undefined;
  if (soldInto) push(accountLink('sold-into', 'Sale paid into', soldInto));

  // What points at this account.
  others.forEach(item => {
    if (item.type === 'Credit Card' && item.settlementAccountId === account.id) push(accountLink('settles', 'Pays card', item));
    if (item.linkedAccountId === account.id) {
      if (item.type === 'Loan') push(accountLink('pays-loan', 'Pays loan', item));
      else if (item.type === 'Lending') push(accountLink('pays-loan', 'Receives repayments from', item));
      else if (item.subType === 'Spare Change') push(accountLink('rounds-up-to', 'Rounds up to', item));
    }
    if (item.type === 'Vehicle' && item.leasePaymentAccountId === account.id) push(accountLink('pays-lease', 'Pays lease', item));
    if (item.closureDetails?.incomeAccountId === account.id) push(accountLink('received-sale', 'Received the sale of', item));
  });

  goals.forEach(goal => {
    if (goal.destinationAccountId === account.id) push({ kind: 'holds-goal', label: 'Holds goal', target: { type: 'goal', goal } });
    else if (goal.paymentAccountId === account.id) push({ kind: 'funds-goal', label: 'Funds goal', target: { type: 'goal', goal } });
  });

  // Frequent transfer partners not already linked.
  const linkedIds = new Set(links.flatMap(link => (link.target.type === 'account' ? [link.target.account.id] : [])));
  transferPartners(account, transactions, accounts, ctx)
    .filter(partner => !linkedIds.has(partner.account.id) && partner.count >= 2)
    .slice(0, 3)
    .forEach(partner => push(accountLink('transfers-with', 'Often moves money with', partner.account, partner.count)));

  return links;
}

/** The accounts this one exchanged transfers with, most frequent first. */
export function transferPartners(account: Account, transactions: Transaction[], accounts: Account[], ctx: Pick<LinkContext, 'since' | 'today'> = {}): { account: Account; count: number }[] {
  const today = ctx.today ?? new Date();
  const since = ctx.since ?? isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 180));
  const byTransfer = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    if (!tx.transferId || tx.date < since) return;
    const list = byTransfer.get(tx.transferId);
    if (list) list.push(tx);
    else byTransfer.set(tx.transferId, [tx]);
  });
  const counts = new Map<string, number>();
  byTransfer.forEach(pair => {
    if (!pair.some(tx => tx.accountId === account.id)) return;
    pair.forEach(tx => {
      if (tx.accountId !== account.id) counts.set(tx.accountId, (counts.get(tx.accountId) || 0) + 1);
    });
  });
  const byId = new Map(accounts.map(item => [item.id, item]));
  return Array.from(counts.entries())
    .flatMap(([id, count]) => {
      const partner = byId.get(id);
      return partner ? [{ account: partner, count }] : [];
    })
    .sort((a, b) => b.count - a.count || a.account.name.localeCompare(b.account.name));
}

/** Transactions tied to an asset with the new `assetId` field. */
export const assetTransactions = (assetId: string, transactions: Transaction[]): Transaction[] =>
  transactions.filter(tx => tx.assetId === assetId);

/** Recurring payments that leave or arrive at this account. */
export const recurringForAccount = (accountId: string, recurring: RecurringTransaction[]): RecurringTransaction[] =>
  recurring.filter(item => item.accountId === accountId || item.toAccountId === accountId);

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
