import { parseLocalDateStrict } from '../utils';

const ARRAY_KEYS = [
    'accounts', 'transactions', 'investmentTransactions', 'recurringTransactions', 'recurringTransactionOverrides',
    'financialGoals', 'budgets', 'tasks', 'warrants', 'memberships', 'importExportHistory', 'billsAndPayments',
    'invoices', 'tags', 'predictions', 'enableBankingConnections', 'incomeCategories', 'expenseCategories',
    'accountOrder', 'taskOrder',
];
const OBJECT_KEYS = ['loanPaymentOverrides', 'manualWarrantPrices', 'priceHistory', 'userStats'];
const DATED: Record<string, string> = { transactions: 'date', recurringTransactions: 'startDate' };
const MAX_REPORTED = 20;

/** Returns human-readable problems found in a backup file; an empty list means it is safe to restore. */
export function validateBackup(json: unknown): string[] {
    const problems: string[] = [];
    if (!json || typeof json !== 'object' || Array.isArray(json)) return ['The file must contain a JSON object.'];
    const data = json as Record<string, any>;

    for (const key of ARRAY_KEYS) {
        if (data[key] === undefined) continue;
        if (!Array.isArray(data[key])) { problems.push(`"${key}" must be a list.`); continue; }
        const dateField = DATED[key];
        (data[key] as unknown[]).forEach((item, i) => {
            if (key === 'accountOrder' || key === 'taskOrder') return;
            if (!item || typeof item !== 'object' || Array.isArray(item)) { problems.push(`${key}[${i}] is not a record.`); return; }
            const rec = item as Record<string, any>;
            if ((key === 'accounts' || key === 'transactions') && (typeof rec.id !== 'string' || !rec.id)) problems.push(`${key}[${i}] has no id.`);
            if (dateField && parseLocalDateStrict(rec[dateField]) === null) problems.push(`${key}[${i}] has an invalid ${dateField}: ${JSON.stringify(rec[dateField])}.`);
        });
    }
    for (const key of OBJECT_KEYS) {
        const v = data[key];
        if (v !== undefined && (!v || typeof v !== 'object' || Array.isArray(v))) problems.push(`"${key}" must be an object.`);
    }
    if (problems.length > MAX_REPORTED) {
        const extra = problems.length - MAX_REPORTED;
        return [...problems.slice(0, MAX_REPORTED), `…and ${extra} more problem${extra === 1 ? '' : 's'}.`];
    }
    return problems;
}
