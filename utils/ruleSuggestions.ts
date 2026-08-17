import { Transaction, TransactionRule } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface SmartRuleSuggestion {
  id: string;
  keyword: string;
  suggestedMerchant: string;
  suggestedCategory?: string;
  suggestedDescription?: string;
  matchCount: number;
  sampleDescriptions: string[];
  totalAmount: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Common noisy prefixes and suffixes in transaction descriptions to clean up
 */
const NOISY_PREFIXES = [
  /^sq\s*\*\s*/i,
  /^tst\s*\*\s*/i,
  /^paypal\s*\*\s*/i,
  /^py\s*\*\s*/i,
  /^sp\s*\*\s*/i,
  /^sumup\s*\*\s*/i,
  /^izettle\s*\*\s*/i,
  /^stripe\s*\*\s*/i,
  /^pos\s+/i,
  /^dd\s*\*\s*/i,
  /^amzn\s*mktp\s*/i,
  /^amzn\s*/i,
  /^vending\s*\*\s*/i,
];

const NOISY_SUFFIXES = [
  /\s*#\s*\d+.*$/i,
  /\s*\.com.*$/i,
  /\s*\.co\.[a-z]{2}.*$/i,
  /\s*\.net.*$/i,
  /\s*\.de.*$/i,
  /\s*\.fr.*$/i,
  /\s*\.uk.*$/i,
  /\s+\d{3,}.*$/i, // Trailing store numbers
  /\s+(llc|inc|gmbh|ltd|corp|sa|sarl|bv)\.?$/i,
  /\s+terminal\s+\d+.*$/i,
  /\s+card\s+\d{4}.*$/i,
];

/**
 * Normalizes and extracts the core brand/merchant name from raw description
 */
export function extractCoreKeyword(rawDescription: string): string {
  let cleaned = (rawDescription || '').trim();

  // Strip prefixes
  for (const prefix of NOISY_PREFIXES) {
    cleaned = cleaned.replace(prefix, '').trim();
  }

  // Strip suffixes
  for (const suffix of NOISY_SUFFIXES) {
    cleaned = cleaned.replace(suffix, '').trim();
  }

  // Remove excessive spaces and special symbols
  cleaned = cleaned.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // If the extracted word is too short or too generic, return original trimmed
  if (cleaned.length < 2) {
    return (rawDescription || '').trim().slice(0, 20);
  }

  // Pick first 2-3 words if very long
  const words = cleaned.split(' ');
  if (words.length > 3) {
    return words.slice(0, 2).join(' ');
  }

  return cleaned;
}

/**
 * Analyzes transactions to detect uncategorized or recurring description patterns and suggest 1-click rules.
 */
export function generateSmartRuleSuggestions(
  transactions: Transaction[],
  existingRules: TransactionRule[] = [],
  merchantRules: Record<string, any> = {}
): SmartRuleSuggestion[] {
  if (!transactions || transactions.length === 0) return [];

  // Map of extracted keyword -> transaction clusters
  const clusters = new Map<string, {
    keyword: string;
    transactions: Transaction[];
    categoryVotes: Map<string, number>;
    merchantVotes: Map<string, number>;
    totalAmount: number;
  }>();

  // Extract keywords for transactions that could benefit from rules (e.g. uncategorized, or repeated raw descriptions)
  for (const tx of transactions) {
    const raw = tx.description || tx.merchant || '';
    if (!raw) continue;

    const core = extractCoreKeyword(raw);
    if (!core || core.length < 3) continue;

    const key = core.toLowerCase();

    // Check if there is already an existing exact rule for this keyword
    const alreadyCoveredByRule = existingRules.some(r =>
      r.conditions?.some(c => c.value?.toLowerCase() === key)
    );
    if (alreadyCoveredByRule) continue;

    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        keyword: core,
        transactions: [],
        categoryVotes: new Map<string, number>(),
        merchantVotes: new Map<string, number>(),
        totalAmount: 0,
      };
      clusters.set(key, cluster);
    }

    cluster.transactions.push(tx);
    cluster.totalAmount += Math.abs(tx.amount || 0);

    if (tx.category) {
      cluster.categoryVotes.set(tx.category, (cluster.categoryVotes.get(tx.category) || 0) + 1);
    }
    if (tx.merchant) {
      cluster.merchantVotes.set(tx.merchant, (cluster.merchantVotes.get(tx.merchant) || 0) + 1);
    }
  }

  const suggestions: SmartRuleSuggestion[] = [];

  for (const [key, cluster] of clusters.entries()) {
    // Only suggest if at least 2 matching transactions exist or if high volume
    if (cluster.transactions.length < 2 && cluster.totalAmount < 50) continue;

    // Determine top category and merchant if available
    let topCategory: string | undefined;
    let maxCatVotes = 0;
    for (const [cat, votes] of cluster.categoryVotes.entries()) {
      if (votes > maxCatVotes) {
        maxCatVotes = votes;
        topCategory = cat;
      }
    }

    let topMerchant: string = cluster.keyword;
    let maxMerchVotes = 0;
    for (const [merch, votes] of cluster.merchantVotes.entries()) {
      if (votes > maxMerchVotes) {
        maxMerchVotes = votes;
        topMerchant = merch;
      }
    }

    // Capitalize merchant nicely
    const formattedMerchant = topMerchant
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const sampleDescriptions = Array.from(
      new Set(cluster.transactions.map(t => t.description).filter(Boolean))
    ).slice(0, 3);

    const confidence: 'high' | 'medium' | 'low' =
      cluster.transactions.length >= 4 || (cluster.transactions.length >= 2 && !!topCategory)
        ? 'high'
        : cluster.transactions.length >= 2
        ? 'medium'
        : 'low';

    suggestions.push({
      id: `sug-${uuidv4().slice(0, 8)}`,
      keyword: cluster.keyword,
      suggestedMerchant: formattedMerchant,
      suggestedCategory: topCategory,
      suggestedDescription: formattedMerchant,
      matchCount: cluster.transactions.length,
      sampleDescriptions,
      totalAmount: cluster.totalAmount,
      confidence,
      reason: topCategory
        ? `Found ${cluster.transactions.length} transactions frequently categorized as "${topCategory}".`
        : `Found ${cluster.transactions.length} recurring transactions matching "${cluster.keyword}".`,
    });
  }

  // Sort by match count & volume
  return suggestions.sort((a, b) => b.matchCount - a.matchCount || b.totalAmount - a.totalAmount).slice(0, 10);
}

/**
 * Converts a SmartRuleSuggestion into a full TransactionRule
 */
export function convertSuggestionToTransactionRule(
  suggestion: SmartRuleSuggestion
): TransactionRule {
  const actions: { field: 'merchant' | 'description' | 'category'; value: string }[] = [];

  if (suggestion.suggestedMerchant) {
    actions.push({ field: 'merchant', value: suggestion.suggestedMerchant });
  }
  if (suggestion.suggestedCategory) {
    actions.push({ field: 'category', value: suggestion.suggestedCategory });
  }

  return {
    id: `rule-${uuidv4()}`,
    name: `Auto ${suggestion.suggestedMerchant}`,
    isActive: true,
    conditionLogic: 'OR',
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: suggestion.keyword,
      },
    ],
    actions,
    priority: 10,
  };
}
