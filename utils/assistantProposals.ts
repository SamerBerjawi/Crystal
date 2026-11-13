import type { Category, CleanupChange, CleanupProposal, Transaction } from '../types';
import { isTidyable } from './cleanup';
import { resolveCategory, type AssistantTool } from './assistantTools';

/*
 * What Ask Crystal may propose. These tools never edit a transaction. They work out the exact edits from the data in
 * the browser and put them in the Tidy-ups queue, where nothing happens until you approve. The model names a merchant
 * and the new value; it never lists transactions itself, so it cannot invent or miss one.
 */

const MAX_CHANGES = 1000;
const plain = (text: unknown) => String(text ?? '').trim().toLowerCase();
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

interface ProposalData {
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  now: () => string;
}

/** The merchant the user means, matched by exact name. Anything else is an error that lists the real names. */
const matchMerchant = (query: unknown, transactions: Transaction[]): { name: string; rows: Transaction[] } | { error: string } => {
  const wanted = plain(query);
  if (!wanted) return { error: 'Say which merchant.' };
  const rows = transactions.filter(tx => isTidyable(tx) && plain(tx.merchant) === wanted);
  if (rows.length > 0) return { name: rows[0].merchant!.trim(), rows };
  const names = [...new Set(transactions.filter(tx => tx.merchant && (plain(tx.merchant).includes(wanted) || wanted.includes(plain(tx.merchant)))).map(tx => tx.merchant!.trim()))].slice(0, 10);
  return { error: names.length ? `No merchant is called "${query}". Close names: ${names.join(', ')}. Ask again with the exact name.` : `No merchant is called "${query}". Search the transactions to find the exact name first.` };
};

const proposal = (key: string, title: string, detail: string, changes: CleanupChange[], now: string): CleanupProposal => ({
  id: `cleanup:assistant:${key}`, kind: 'assistant', title, detail, source: 'assistant', status: 'pending', createdAt: now, changes,
});

const reasonOf = (args: Record<string, any>) => (typeof args.reason === 'string' ? args.reason.trim().slice(0, 200) : '');

const queued = (item: CleanupProposal, note?: string) => ({
  proposed: true,
  title: item.title,
  changes: item.changes.length,
  summary: `Added "${item.title}" (${count(item.changes.length, 'change')}) to the Tidy-ups queue. Nothing has changed yet; the user approves it in the Queue tab of Transactions.`,
  ...(note ? { note } : {}),
});

export const buildProposalTools = (data: ProposalData, onPropose: (item: CleanupProposal) => void): AssistantTool[] => [
  {
    name: 'propose_recategorise',
    description: 'Suggest filing every transaction of one merchant under one category. Use when the user wants a merchant recategorised or asks to tidy categories. It only adds a suggestion to the Tidy-ups queue; the user approves it there and nothing changes before that.',
    parameters: {
      type: 'object',
      properties: {
        merchant: { type: 'string', description: 'The exact merchant name.' },
        category: { type: 'string', description: 'The exact category to file it under.' },
        reason: { type: 'string', description: 'One short sentence on why.' },
      },
      required: ['merchant', 'category'],
    },
    run: args => {
      const merchant = matchMerchant(args.merchant, data.transactions);
      if ('error' in merchant) return { error: merchant.error };
      const category = resolveCategory(String(args.category ?? ''), [...data.expenseCategories, ...data.incomeCategories]);
      if ('error' in category) return { error: category.error };
      const changes: CleanupChange[] = merchant.rows
        .filter(tx => tx.category !== category.name)
        .map(tx => ({ transactionId: tx.id, field: 'category', from: tx.category, to: category.name }));
      if (changes.length === 0) return { proposed: false, summary: `Every ${merchant.name} transaction is already filed under ${category.name}. Nothing to propose.` };
      if (changes.length > MAX_CHANGES) return { error: `That would change ${changes.length} transactions. Ask for a narrower change.` };
      const item = proposal(`recategorise:${plain(merchant.name)}>${plain(category.name)}`, `File ${merchant.name} under ${category.name}`, reasonOf(args) || `${count(changes.length, 'transaction')} would move.`, changes, data.now());
      onPropose(item);
      return queued(item, category.note);
    },
  },
  {
    name: 'propose_rename_merchant',
    description: 'Suggest renaming a merchant on all its transactions, for example to merge two spellings. It only adds a suggestion to the Tidy-ups queue; the user approves it there and nothing changes before that.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'The exact current merchant name.' },
        to: { type: 'string', description: 'The new name.' },
        reason: { type: 'string', description: 'One short sentence on why.' },
      },
      required: ['from', 'to'],
    },
    run: args => {
      const merchant = matchMerchant(args.from, data.transactions);
      if ('error' in merchant) return { error: merchant.error };
      const to = typeof args.to === 'string' ? args.to.trim() : '';
      if (!to || to.length > 100) return { error: 'The new name must be between 1 and 100 characters.' };
      const changes: CleanupChange[] = merchant.rows
        .filter(tx => tx.merchant !== to)
        .map(tx => ({ transactionId: tx.id, field: 'merchant', from: tx.merchant ?? '', to }));
      if (changes.length === 0) return { proposed: false, summary: `Those transactions are already called ${to}. Nothing to propose.` };
      if (changes.length > MAX_CHANGES) return { error: `That would change ${changes.length} transactions. Ask for a narrower change.` };
      const item = proposal(`rename:${plain(merchant.name)}>${plain(to)}`, `Call ${merchant.name} ${to}`, reasonOf(args) || `${count(changes.length, 'transaction')} would be renamed.`, changes, data.now());
      onPropose(item);
      return queued(item);
    },
  },
];

/** A new suggestion replaces an older one for the same change, so asking twice does not pile up copies. */
export const addProposal = (list: CleanupProposal[], item: CleanupProposal): CleanupProposal[] => [...list.filter(existing => existing.id !== item.id), item];
