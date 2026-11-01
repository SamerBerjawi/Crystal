import { v4 as uuidv4 } from 'uuid';
import { MerchantLocation, MerchantRule, Transaction, TransactionRule } from '../types';
import { normalizeMerchantKey } from './brandfetch';
import { ordinaryRules } from './rules';

export const googleMapsUrl = (latitude: number, longitude: number) => `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

export const hasCoordinates = (place: { latitude?: number; longitude?: number }) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude);

/** A merchant's branches. Older rules hold one address on the rule itself. */
export const branchesOf = (rule?: MerchantRule): MerchantLocation[] => {
  if (rule?.locations?.length) return rule.locations;
  if (!rule?.address && !hasCoordinates(rule ?? {})) return [];
  return [{
    id: 'main-branch',
    label: rule!.placeName || 'Main branch',
    address: rule!.address || '',
    placeName: rule!.placeName,
    street: rule!.street,
    city: rule!.city,
    postalCode: rule!.postalCode,
    state: rule!.state,
    country: rule!.country,
    latitude: rule!.latitude,
    longitude: rule!.longitude,
    isPrimary: true,
  }];
};

export const primaryBranch = (branches: MerchantLocation[]) => branches.find(branch => branch.isPrimary) || branches[0];

export const branchName = (branch: MerchantLocation) => branch.label || branch.placeName || branch.city || 'Branch';

/** Removing the primary branch hands the role to the first one left. */
export const removeBranch = (branches: MerchantLocation[], id: string): MerchantLocation[] => {
  const left = branches.filter(branch => branch.id !== id);
  if (left.length === 0 || left.some(branch => branch.isPrimary)) return left;
  return left.map((branch, index) => ({ ...branch, isPrimary: index === 0 }));
};

/** The primary branch is copied onto the rule, which older code and the transaction form still read. */
export const withBranches = (rule: MerchantRule, branches: MerchantLocation[]): MerchantRule => {
  const primary = primaryBranch(branches);
  return {
    ...rule,
    locations: branches.length > 0 ? branches : undefined,
    address: primary?.address || undefined,
    placeName: primary?.placeName || undefined,
    street: primary?.street || undefined,
    city: primary?.city || undefined,
    postalCode: primary?.postalCode || undefined,
    state: primary?.state || undefined,
    country: primary?.country || undefined,
    latitude: primary?.latitude,
    longitude: primary?.longitude,
  };
};

const isMerchantTransaction = (tx: Transaction, logoKey: string, merchantName: string) =>
  normalizeMerchantKey(tx.merchant || '') === logoKey || (!!tx.merchant && tx.merchant.toLowerCase().trim() === merchantName.toLowerCase().trim());

export const merchantTransactionCount = (transactions: Transaction[], logoKey: string, merchantName: string) =>
  transactions.filter(tx => isMerchantTransaction(tx, logoKey, merchantName)).length;

/** Stamps the primary branch on every transaction of the merchant. Fields it doesn't have stay as they were. */
export const transactionsAtBranch = (transactions: Transaction[], logoKey: string, merchantName: string, branch: MerchantLocation): Transaction[] =>
  transactions.filter(tx => isMerchantTransaction(tx, logoKey, merchantName)).map(tx => ({
    ...tx,
    address: branch.address || tx.address,
    placeName: branch.placeName || tx.placeName,
    street: branch.street || tx.street,
    city: branch.city || tx.city,
    postalCode: branch.postalCode || tx.postalCode,
    state: branch.state || tx.state,
    country: branch.country || tx.country,
    latitude: branch.latitude ?? tx.latitude,
    longitude: branch.longitude ?? tx.longitude,
    locationLabel: branch.label || branch.placeName || branch.city,
  }));

/** Ordinary rules that set this merchant or look for its name. Its always file rule is shown as Category instead. */
export const keywordRulesFor = (rules: TransactionRule[] | undefined, merchantName: string) => {
  const name = merchantName.toLowerCase();
  return ordinaryRules(rules).filter(rule =>
    rule.actions.some(action => action.field === 'merchant' && action.value.toLowerCase() === name)
    || rule.conditions.some(condition => condition.value?.toLowerCase() === name));
};

export const keywordOf = (rule: TransactionRule) => rule.conditions.find(condition => condition.field === 'description' || condition.field === 'merchant')?.value ?? '';

export const transactionsWithKeyword = (transactions: Transaction[], keyword: string) => {
  const text = keyword.trim().toLowerCase();
  if (!text) return [];
  return transactions.filter(tx => (tx.description || '').toLowerCase().includes(text) || (tx.merchant || '').toLowerCase().includes(text));
};

export const newKeywordRule = (merchantName: string, keyword: string, category?: string, description?: string): TransactionRule => ({
  id: `rule-${uuidv4()}`,
  name: `Auto ${merchantName} (${keyword})`,
  isActive: true,
  priority: 10,
  conditionLogic: 'OR',
  conditions: [{ field: 'description', operator: 'contains', value: keyword }],
  actions: [
    { field: 'merchant', value: merchantName },
    ...(category ? [{ field: 'category' as const, value: category }] : []),
    ...(description ? [{ field: 'description' as const, value: description }] : []),
  ],
});
