import { Account, Transaction } from '../types';
import { convertToEur } from '../utils';
import { normalizeMerchantKey } from './brandfetch';

export interface TrendEntity { id: string; type: string; logoKey: string }

/**
 * Monthly spend per merchant/institution entity for the given "YYYY-MM" buckets.
 * Single pass over the ledger (O(transactions + entities)) instead of one scan per entity.
 */
export const computeSpendTrends = (
  entities: TrendEntity[],
  transactions: Transaction[],
  accounts: Account[],
  months: string[],
  showBalanceAdjustments: boolean,
): Record<string, number[]> => {
  const width = months.length;
  const monthIndex = new Map(months.map((m, i) => [m, i] as const));
  const byMerchant = new Map<string, number[]>();
  const byAccount = new Map<string, number[]>();
  const bucket = (m: Map<string, number[]>, key: string) => {
    let sums = m.get(key);
    if (!sums) { sums = Array(width).fill(0); m.set(key, sums); }
    return sums;
  };

  for (const tx of transactions) {
    if (!showBalanceAdjustments && tx.isBalanceAdjustment) continue;
    const idx = monthIndex.get(tx.date.slice(0, 7));
    if (idx === undefined) continue;
    const amount = Math.abs(convertToEur(tx.amount, tx.currency));
    if (tx.merchant) {
      const key = normalizeMerchantKey(tx.merchant);
      if (key) bucket(byMerchant, key)[idx] += amount;
    }
    bucket(byAccount, tx.accountId)[idx] += amount;
  }

  const accountIdsByInstitution = new Map<string, string[]>();
  for (const acc of accounts) {
    const key = acc.financialInstitution ? normalizeMerchantKey(acc.financialInstitution) : null;
    if (!key) continue;
    const ids = accountIdsByInstitution.get(key);
    if (ids) ids.push(acc.id); else accountIdsByInstitution.set(key, [acc.id]);
  }

  const result: Record<string, number[]> = {};
  for (const entity of entities) {
    const sums: number[] = Array(width).fill(0);
    if (entity.type === 'Merchant') {
      byMerchant.get(entity.logoKey)?.forEach((v, i) => { sums[i] = v; });
    } else {
      for (const id of accountIdsByInstitution.get(entity.logoKey) || []) {
        byAccount.get(id)?.forEach((v, i) => { sums[i] += v; });
      }
    }
    result[entity.id] = sums;
  }
  return result;
};
