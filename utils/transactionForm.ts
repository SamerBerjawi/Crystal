import { v4 as uuidv4 } from 'uuid';
import type { Account, MerchantLocation, MerchantRule, Transaction, TransactionRule } from '../types';
import { fuzzySearch, safeRound, toLocalISOString } from '../utils';
import { normalizeMerchantKey } from './brandfetch';
import { parseLocationString } from './locationDetector';
import { applyTransactionRulesToFields } from './rules';

export type TxType = 'expense' | 'income' | 'transfer';
export type TxDraftSave = Omit<Transaction, 'id'> & { id?: string };

export interface TxLocation {
  address: string;
  placeName: string;
  street: string;
  city: string;
  postalCode: string;
  stateRegion: string;
  country: string;
  latitude?: number;
  longitude?: number;
  locationLabel: string;
}

export interface TxForm extends TxLocation {
  type: TxType;
  amount: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  merchant: string;
  category: string;
  description: string;
  notes: string;
  tagIds: string[];
  /** What you changed yourself. Autofill leaves these alone (AUT-04). */
  descriptionEdited: boolean;
  categoryEdited: boolean;
  locationEdited: boolean;
  syncLocationToMerchant: boolean;
  principal: string;
  interest: string;
  autoLoanSplit: boolean;
  roundUpOn: boolean;
  roundUpBehavior: 'skip' | 'unit';
  roundUpMultiplier: string;
  existingRoundUpId?: string;
}

export interface TxInitial {
  date?: string;
  amount?: string;
  principal?: string;
  interest?: string;
  description?: string;
  merchant?: string;
  tagIds?: string[];
  locationString?: string;
  locationData?: { city?: string; country?: string; lat?: number; lon?: number; address?: string; placeName?: string; street?: string; postalCode?: string; state?: string; label?: string };
  notes?: string;
}

export interface TxFormContext {
  accounts: Account[];
  transactions: Transaction[];
  merchantRules: Record<string, MerchantRule>;
  transactionRules: TransactionRule[];
}

export const NO_BRANCH_MERCHANTS = ['Internal Transfer', 'Round Up', 'Manual balance correction'];

const EMPTY_LOCATION: TxLocation = { address: '', placeName: '', street: '', city: '', postalCode: '', stateRegion: '', country: '', latitude: undefined, longitude: undefined, locationLabel: '' };

const money = (value: number) => safeRound(Math.abs(value), 2).toFixed(2);

/** The round-up of a transaction, by its id, or by date and name for records saved before round-ups carried one. */
export const findRoundUp = (tx: Transaction, transactions: Transaction[]): Transaction | undefined => {
  const targetId = (tx as Transaction & { originalId?: string }).originalId || tx.id;
  const isSpare = (t: Transaction) => !!t.transferId?.startsWith('spare-');
  const bound = transactions.find(t => t.transferId === `spare-${targetId}` || (isSpare(t) && t.transferId!.includes(targetId)));
  if (bound) return bound;
  const accountId = tx.transferId && tx.type !== 'expense' ? transactions.find(t => t.transferId === tx.transferId && t.type === 'expense')?.accountId : tx.accountId;
  const hasOwner = (t: Transaction) => transactions.some(other => t.transferId!.includes(other.id));
  return transactions.find(t => t.accountId === accountId && t.date === tx.date && t.merchant === 'Round Up' && isSpare(t) && !hasOwner(t) && t.description.includes(tx.description || ''));
};

export const initialTxForm = (
  options: { edit?: Transaction | null; type?: TxType; fromAccountId?: string; toAccountId?: string; category?: string; details?: TxInitial; defaultCity?: string },
  ctx: TxFormContext
): TxForm => {
  const { edit, details, defaultCity } = options;
  const primary = ctx.accounts.find(account => account.isPrimary)?.id ?? ctx.accounts[0]?.id ?? '';
  const data = details?.locationData;
  const parsedCity = !edit && defaultCity ? parseLocationString(defaultCity) : null;

  const form: TxForm = {
    ...EMPTY_LOCATION,
    type: options.type || 'expense',
    amount: '',
    date: details?.date || toLocalISOString(new Date()),
    fromAccountId: options.fromAccountId || primary,
    toAccountId: options.toAccountId || primary,
    merchant: details?.merchant || '',
    category: options.category || (options.type === 'transfer' ? 'Transfer' : ''),
    description: details?.description || '',
    notes: details?.notes || '',
    tagIds: details?.tagIds || [],
    descriptionEdited: !!details?.description,
    categoryEdited: !!options.category,
    locationEdited: !!(data?.address || details?.locationString),
    syncLocationToMerchant: true,
    principal: details?.principal || '',
    interest: details?.interest || '',
    autoLoanSplit: !(details?.principal || details?.interest),
    roundUpOn: true,
    roundUpBehavior: 'skip',
    roundUpMultiplier: '1',
    address: data?.address || details?.locationString || defaultCity || '',
    placeName: data?.placeName || '',
    street: data?.street || '',
    city: data?.city || parsedCity?.city || '',
    postalCode: data?.postalCode || '',
    stateRegion: data?.state || '',
    country: data?.country || parsedCity?.country || '',
    latitude: data?.lat,
    longitude: data?.lon,
    locationLabel: data?.label || '',
  };

  if (details?.amount) {
    const value = parseFloat(details.amount);
    form.amount = !isNaN(value) && value !== 0 ? money(value) : details.amount;
  }
  if (!edit) return form.type === 'transfer' && form.fromAccountId === form.toAccountId
    ? { ...form, ...(options.toAccountId ? { fromAccountId: '' } : { toAccountId: '' }) }
    : form;

  const location: TxLocation = edit.address || edit.city || edit.country ? {
    address: edit.address || [edit.city, edit.country].filter(Boolean).join(', '),
    placeName: edit.placeName || '',
    street: edit.street || '',
    city: edit.city || '',
    postalCode: edit.postalCode || '',
    stateRegion: edit.state || '',
    country: edit.country || '',
    latitude: edit.latitude,
    longitude: edit.longitude,
    locationLabel: edit.locationLabel || '',
  } : EMPTY_LOCATION;

  const base = { ...form, ...location, date: edit.date, notes: edit.notes || '', tagIds: edit.tagIds || [], categoryEdited: !!edit.category, descriptionEdited: !!edit.description, locationEdited: !!edit.address };
  const extras = { existingRoundUpId: findRoundUp(edit, ctx.transactions)?.id };
  const split = (tx: Transaction) => ({ principal: String(tx.principalAmount || ''), interest: String(tx.interestAmount || ''), autoLoanSplit: !(tx.principalAmount || tx.interestAmount) });

  if (edit.transferId) {
    const counterpart = ctx.transactions.find(t => t.transferId === edit.transferId && t.id !== edit.id);
    const expense = edit.type === 'expense' ? edit : counterpart;
    const income = edit.type === 'income' ? edit : counterpart;
    return {
      ...base,
      ...extras,
      ...(income ? split(income) : {}),
      type: 'transfer',
      amount: money(income?.amount ?? edit.amount),
      fromAccountId: expense?.accountId || form.fromAccountId,
      toAccountId: income?.accountId || form.toAccountId,
      description: edit.description.replace(/Transfer to .*|Transfer from .*/, 'Account Transfer'),
      merchant: edit.merchant || 'Internal Transfer',
      category: edit.category || 'Transfer',
    };
  }

  return {
    ...base,
    ...extras,
    ...split(edit),
    type: edit.type,
    amount: money(edit.amount),
    fromAccountId: edit.type === 'income' ? primary : edit.accountId,
    toAccountId: edit.type === 'income' ? edit.accountId : primary,
    description: edit.description,
    merchant: edit.merchant || '',
    category: edit.category,
  };
};

/** A transfer can't start with one account on both sides, and income needs somewhere to land. */
export const accountsForType = (form: Pick<TxForm, 'fromAccountId' | 'toAccountId'>, type: TxType) => {
  if (type === 'transfer' && form.fromAccountId === form.toAccountId) return { toAccountId: '' };
  if (type === 'income' && !form.toAccountId) return { toAccountId: form.fromAccountId };
  return {};
};

export const clearedLocation = (): TxLocation => ({ ...EMPTY_LOCATION });

export const branchesFor = (rule?: MerchantRule | null): MerchantLocation[] => {
  if (!rule) return [];
  if (rule.locations?.length) return rule.locations;
  if (!rule.address) return [];
  return [{
    id: 'loc-primary', label: rule.placeName || 'Main Branch', address: rule.address, placeName: rule.placeName, street: rule.street, city: rule.city,
    postalCode: rule.postalCode, state: rule.state, country: rule.country, latitude: rule.latitude, longitude: rule.longitude, isPrimary: true,
  }];
};

export const locationFromBranch = (branch: MerchantLocation): TxLocation => ({
  address: branch.address,
  placeName: branch.placeName || '',
  street: branch.street || '',
  city: branch.city || '',
  postalCode: branch.postalCode || '',
  stateRegion: branch.state || '',
  country: branch.country || '',
  latitude: branch.latitude,
  longitude: branch.longitude,
  locationLabel: branch.label || '',
});

export const ruleFor = (name: string, rules: Record<string, MerchantRule>): MerchantRule | null => {
  if (!name) return null;
  return rules[normalizeMerchantKey(name)] || rules[name.trim().toLowerCase()] || null;
};

export interface AutofillForce {
  description?: boolean;
  category?: boolean;
  location?: boolean;
}

/** Fills category, description and location from the merchant, else from your rules (AUT-01 to AUT-08). Your own edits stay. */
export const autofill = (form: TxForm, ctx: Pick<TxFormContext, 'merchantRules' | 'transactionRules'>, force: AutofillForce = {}): Partial<TxForm> => {
  const { merchant, description, category, amount, type, address } = form;
  const patch: Partial<TxForm> = {};
  const key = normalizeMerchantKey(merchant || description);
  const rule = key ? ctx.merchantRules[key] : undefined;

  if (rule) {
    if (rule.category && (force.category || !form.categoryEdited || !category)) patch.category = rule.category;
    if (rule.defaultDescription && (force.description || !form.descriptionEdited || !description.trim() || description.toLowerCase() === merchant.toLowerCase())) {
      patch.description = rule.defaultDescription;
      patch.descriptionEdited = false;
    }
    if (force.location || !form.locationEdited || !address.trim()) {
      const branches = branchesFor(rule);
      const branch = branches.find(item => item.isPrimary) || branches[0];
      if (branch) Object.assign(patch, locationFromBranch(branch));
    }
    if (rule.category || rule.defaultDescription || rule.address || rule.locations?.length) return patch;
  }

  const result = applyTransactionRulesToFields({ description, merchant, category, amount: parseFloat(amount) || 0, type }, ctx.merchantRules, ctx.transactionRules);
  if (result.category && (force.category || !form.categoryEdited || !category)) patch.category = result.category;
  if (result.merchant && result.merchant !== merchant) patch.merchant = result.merchant;
  if (result.description && (force.description || !form.descriptionEdited || !description.trim())) {
    patch.description = result.description;
    patch.descriptionEdited = false;
  }
  return patch;
};

export interface MerchantSuggestion { name: string; count: number; category?: string }

/** Past merchants, most frequent first, each with its category (AUT-06). */
export const merchantSuggestions = (transactions: Transaction[], rules: Record<string, MerchantRule>): MerchantSuggestion[] => {
  const counts = new Map<string, { count: number; category?: string }>();
  transactions.forEach(tx => {
    const name = tx.merchant?.trim();
    if (!name) return;
    const entry = counts.get(name);
    if (entry) {
      entry.count += 1;
      entry.category ||= tx.category || undefined;
    } else {
      counts.set(name, { count: 1, category: tx.category || undefined });
    }
  });
  return [...counts.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, category: rules[normalizeMerchantKey(name)]?.category || entry.category }))
    .sort((a, b) => b.count - a.count);
};

export const matchMerchants = (all: MerchantSuggestion[], query: string): MerchantSuggestion[] => {
  const text = query.toLowerCase().trim();
  if (!text) return all.slice(0, 6);
  const exact = all.filter(item => item.name.toLowerCase() === text);
  const prefix = all.filter(item => item.name.toLowerCase().startsWith(text) && !exact.includes(item));
  const rest = all.filter(item => (item.name.toLowerCase().includes(text) || fuzzySearch(text, item.name)) && !exact.includes(item) && !prefix.includes(item));
  return [...exact, ...prefix, ...rest].slice(0, 8);
};

/** The loan this payment goes to. A charge on a loan account is a plain expense, with no split. */
export const loanAccountFor = (form: Pick<TxForm, 'type' | 'fromAccountId' | 'toAccountId'>, accounts: Account[]): Account | undefined => {
  if (form.type === 'expense') return undefined;
  const isLoan = (account?: Account) => account?.type === 'Loan' || account?.type === 'Lending';
  const byId = (id: string) => accounts.find(account => account.id === id);
  return (form.type === 'transfer' ? [byId(form.fromAccountId), byId(form.toAccountId)] : [byId(form.toAccountId)]).find(isLoan);
};

/** Interest is a month on the balance, capped at the payment. The rest is principal (AUT-14). */
export const withAutoLoanSplit = (form: TxForm, accounts: Account[]): TxForm => {
  const loan = loanAccountFor(form, accounts);
  if (!loan) return form.principal || form.interest ? { ...form, principal: '', interest: '' } : form;
  const total = parseFloat(form.amount);
  if (!form.autoLoanSplit || !loan.interestRate || !(total > 0)) return form;
  const interest = Math.min(total, parseFloat((Math.abs(loan.balance) * (loan.interestRate / 100 / 12)).toFixed(2)));
  return { ...form, principal: (total - interest).toFixed(2), interest: interest.toFixed(2) };
};

/** Typing one part sets the other, so they always add up to the payment. */
export const editLoanPart = (form: TxForm, part: 'principal' | 'interest', text: string): TxForm => {
  const total = parseFloat(form.amount) || 0;
  const value = Math.max(0, Math.min(total, parseFloat(text) || 0));
  const other = (total - value).toFixed(2);
  return part === 'principal'
    ? { ...form, autoLoanSplit: false, principal: String(value), interest: other }
    : { ...form, autoLoanSplit: false, interest: String(value), principal: other };
};

export const spareAccountFor = (form: Pick<TxForm, 'type' | 'fromAccountId'>, accounts: Account[]) => {
  if ((form.type !== 'expense' && form.type !== 'transfer') || !form.fromAccountId) return undefined;
  return accounts.find(account => account.type === 'Investment' && account.subType === 'Spare Change' && account.linkedAccountId === form.fromAccountId);
};

export const roundUpFor = (form: Pick<TxForm, 'amount' | 'roundUpBehavior' | 'roundUpMultiplier'>): number => {
  const value = parseFloat(form.amount);
  if (isNaN(value) || value <= 0) return 0;
  const remainder = parseFloat((value % 1).toFixed(2));
  const base = remainder === 0 ? (form.roundUpBehavior === 'unit' ? 1 : 0) : 1 - remainder;
  const multiplier = parseFloat(form.roundUpMultiplier);
  return parseFloat((base * (isNaN(multiplier) ? 1 : Math.max(0, multiplier))).toFixed(2));
};

const locationFields = (form: TxForm) => {
  if (!(form.address.trim() || form.city.trim() || form.country.trim())) return {};
  const text = (value: string) => value.trim() || undefined;
  const coordinate = (value?: number) => (value !== undefined && !isNaN(value) ? value : undefined);
  return {
    address: text(form.address), placeName: text(form.placeName), street: text(form.street), city: text(form.city), postalCode: text(form.postalCode),
    state: text(form.stateRegion), country: text(form.country), latitude: coordinate(form.latitude), longitude: coordinate(form.longitude), locationLabel: text(form.locationLabel),
  };
};

export type TxSavePlan =
  | { ok: false; error: string }
  | { ok: true; toSave: TxDraftSave[]; toDelete: string[]; branch?: { key: string; location: MerchantLocation } };

/** Everything a save writes: the transaction or transfer pair, its loan split, its round-up, and a merchant branch. */
export const planTransactionSave = (form: TxForm, edit: Transaction | null | undefined, ctx: Pick<TxFormContext, 'accounts' | 'transactions'>): TxSavePlan => {
  const { type, date, description, merchant, category, notes, tagIds, fromAccountId, toAccountId } = form;
  const { accounts, transactions } = ctx;
  const loan = loanAccountFor(form, accounts);
  const total = loan ? safeRound((parseFloat(form.principal) || 0) + (parseFloat(form.interest) || 0), 2) : safeRound(parseFloat(form.amount) || 0, 2);
  if (!total) return { ok: false, error: loan ? 'Enter the principal and the interest' : 'Enter an amount' };
  if (!description.trim()) return { ok: false, error: 'Add a description' };

  const location = locationFields(form);
  const toSave: TxDraftSave[] = [];
  const toDelete: string[] = [];
  const wasTransfer = !!edit?.transferId;
  const isTransfer = type === 'transfer';
  const loanFields = { principalAmount: safeRound(parseFloat(form.principal) || 0, 2), interestAmount: safeRound(parseFloat(form.interest) || 0, 2) };

  if (edit && wasTransfer && !isTransfer) {
    toDelete.push(edit.id);
    const counterpart = transactions.find(t => t.transferId === edit.transferId && t.id !== edit.id);
    if (counterpart) toDelete.push(counterpart.id);
  } else if (edit && !wasTransfer && isTransfer) {
    toDelete.push(edit.id);
  }

  if (isTransfer) {
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return { ok: false, error: 'Pick two different accounts' };
    const from = accounts.find(account => account.id === fromAccountId);
    const to = accounts.find(account => account.id === toAccountId);
    if (!from || !to) return { ok: false, error: 'Pick two different accounts' };
    const transferId = edit && wasTransfer ? edit.transferId! : `xfer-${uuidv4()}`;
    const amount = safeRound(Math.abs(total), 2);
    const shared = { date, merchant: merchant || 'Internal Transfer', category: category || 'Transfer', transferId, tagIds, notes, ...location };
    const expense: TxDraftSave = { ...shared, accountId: fromAccountId, description: description || `Transfer to ${to.name}`, amount: -amount, type: 'expense', currency: from.currency };
    const income: TxDraftSave = { ...shared, accountId: toAccountId, description: description || `Transfer from ${from.name}`, amount, type: 'income', currency: to.currency };
    if (loan) Object.assign(expense.accountId === loan.id ? expense : income, loanFields);
    if (edit && wasTransfer) {
      expense.id = transactions.find(t => t.transferId === transferId && t.type === 'expense')?.id;
      income.id = transactions.find(t => t.transferId === transferId && t.type === 'income')?.id;
    } else {
      expense.id = uuidv4();
      income.id = uuidv4();
    }
    toSave.push(expense, income);
  } else {
    const accountId = type === 'income' ? toAccountId : fromAccountId;
    const account = accounts.find(item => item.id === accountId);
    if (!account || !category) return { ok: false, error: 'Pick an account and a category' };
    const signed = safeRound(Math.abs(total), 2);
    toSave.push({
      accountId, date, description, merchant, amount: type === 'expense' ? -signed : signed, category, type, currency: account.currency, tagIds, notes, ...location,
      ...(loan?.id === accountId ? loanFields : {}),
      id: edit && !wasTransfer ? edit.id : uuidv4(),
    });
  }

  const spare = spareAccountFor(form, accounts);
  const roundUp = roundUpFor(form);
  const existing = transactions.find(t => t.id === form.existingRoundUpId);
  const existingPair = existing && transactions.find(t => t.transferId === existing.transferId && t.id !== existing.id);
  if (existing && !(spare && form.roundUpOn && roundUp > 0)) {
    toDelete.push(existing.id);
    if (existingPair) toDelete.push(existingPair.id);
  } else if (spare && form.roundUpOn && roundUp > 0) {
    const source = accounts.find(account => account.id === fromAccountId);
    if (source) {
      const transferId = existing?.transferId || `spare-${toSave[0].id || uuidv4()}`;
      const shared = { date, merchant: 'Round Up', category: 'Transfer', transferId };
      toSave.push(
        { ...shared, id: existing?.id, accountId: fromAccountId, description: `Spare change for ${description || 'Transaction'}`, amount: -roundUp, type: 'expense', currency: source.currency },
        { ...shared, id: existingPair?.id, accountId: spare.id, description: `Spare change from ${description || 'Transaction'}`, amount: roundUp, type: 'income', currency: spare.currency },
      );
    }
  }

  const name = merchant.trim();
  const key = normalizeMerchantKey(merchant);
  if (form.syncLocationToMerchant && 'city' in location && name && key && !NO_BRANCH_MERCHANTS.includes(name)) {
    return {
      ok: true, toSave, toDelete,
      branch: {
        key,
        location: {
          id: uuidv4(),
          label: form.locationLabel.trim() || form.placeName.trim() || form.city.trim() || `${name} Branch`,
          address: form.address.trim() || [form.street, form.city, form.country].filter(Boolean).join(', '),
          placeName: location.placeName, street: location.street, city: location.city, postalCode: location.postalCode, state: location.state,
          country: location.country, latitude: location.latitude, longitude: location.longitude, isPrimary: true,
        },
      },
    };
  }
  return { ok: true, toSave, toDelete };
};

/** Adds a location to a merchant as a new branch, or updates the one at the same place (AUT-10). */
export const mergeBranch = (rule: MerchantRule, branch: MerchantLocation): MerchantRule => {
  const existing = rule.locations || [];
  const index = existing.findIndex(item =>
    (!!branch.address && !!item.address && item.address.toLowerCase().trim() === branch.address.toLowerCase().trim())
    || (!!branch.latitude && !!item.latitude && Math.abs(item.latitude - branch.latitude) < 0.0001 && Math.abs((item.longitude ?? 0) - (branch.longitude ?? 0)) < 0.0001));

  const locations = index >= 0
    ? existing.map((item, i) => (i === index ? { ...item, ...branch, id: item.id, isPrimary: item.isPrimary ?? true } : item))
    : [...existing, { ...branch, isPrimary: !existing.some(item => item.isPrimary) }];
  const primary = locations.find(item => item.isPrimary) || locations[0];

  return {
    ...rule,
    locations,
    address: primary?.address || branch.address,
    placeName: primary?.placeName || branch.placeName,
    street: primary?.street || branch.street,
    city: primary?.city || branch.city,
    postalCode: primary?.postalCode || branch.postalCode,
    state: primary?.state || branch.state,
    country: primary?.country || branch.country,
    latitude: primary?.latitude ?? branch.latitude,
    longitude: primary?.longitude ?? branch.longitude,
  };
};
