import { Category, Transaction } from '../types';
import { safeRound } from '../utils';

export interface BulkLocation {
  address?: string;
  placeName?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  locationLabel?: string;
}

export interface BulkValues {
  date: string;
  accountId: string;
  description: string;
  merchant: string;
  category: string;
  tagIds: string[];
  locationText: string;
  location: BulkLocation;
}

export type BulkField = 'date' | 'accountId' | 'description' | 'merchant' | 'category' | 'tags' | 'location';

const findCategory = (name: string, categories: Category[]): Category | undefined => {
  for (const category of categories) {
    if (category.name === name) return category;
    const found = findCategory(name, category.subCategories ?? []);
    if (found) return found;
  }
  return undefined;
};

const locationFields = ({ locationText, location }: BulkValues): Partial<Transaction> => {
  const text = locationText.trim();
  if (!text) {
    return { address: undefined, placeName: undefined, street: undefined, city: undefined, postalCode: undefined, state: undefined, country: undefined, latitude: undefined, longitude: undefined, locationLabel: undefined };
  }
  return {
    address: location.address || text,
    placeName: location.placeName,
    street: location.street,
    city: location.city || text,
    postalCode: location.postalCode,
    state: location.state,
    country: location.country,
    latitude: location.lat,
    longitude: location.lon,
    locationLabel: location.locationLabel,
  };
};

/** Both sides of a transfer share these, so they stay in step. */
const sharedFields = (tx: Transaction, fields: Set<BulkField>, values: BulkValues): Transaction => ({
  ...tx,
  ...(fields.has('date') ? { date: values.date } : {}),
  ...(fields.has('description') ? { description: values.description } : {}),
  ...(fields.has('merchant') ? { merchant: values.merchant } : {}),
  ...(fields.has('tags') ? { tagIds: values.tagIds } : {}),
  ...(fields.has('location') ? locationFields(values) : {}),
});

/** A new category sets income or expense, and turns a transfer into an ordinary transaction, which removes its other side. */
export const applyBulkEdit = (selected: Transaction[], all: Transaction[], fields: Set<BulkField>, values: BulkValues, categories: Category[]) => {
  const updated = new Map<string, Transaction>();
  const idsToDelete: string[] = [];
  const recategorise = fields.has('category') && !!values.category;
  const kind = recategorise ? findCategory(values.category, categories)?.classification : undefined;

  selected.forEach(tx => {
    const next = sharedFields(tx, fields, values);
    if (fields.has('accountId')) next.accountId = values.accountId;
    const counterpart = tx.transferId ? all.find(other => other.transferId === tx.transferId && other.id !== tx.id) : undefined;

    if (recategorise) {
      next.category = values.category;
      if (kind) {
        next.type = kind;
        next.amount = (kind === 'income' ? 1 : -1) * safeRound(Math.abs(next.amount), 2);
      }
      if (tx.transferId) {
        next.transferId = undefined;
        if (counterpart) idsToDelete.push(counterpart.id);
      }
    } else if (counterpart && !updated.has(counterpart.id)) {
      updated.set(counterpart.id, sharedFields(counterpart, fields, values));
    }

    updated.set(next.id, next);
  });

  return { updated: [...updated.values()], idsToDelete };
};
