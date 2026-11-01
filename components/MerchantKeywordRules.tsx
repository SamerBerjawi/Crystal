import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Transaction, TransactionRule } from '../types';
import { usePreferencesContext, useTransactionsContext } from '../contexts/DomainProviders';
import { keywordOf, keywordRulesFor, newKeywordRule, transactionsWithKeyword } from '../utils/merchantModel';
import { Button, IconButton } from './ui/Actions';
import { Switch, TextInput } from './ui/Fields';
import { Menu } from './ui/Menu';

/** Keywords that file bank transactions under this merchant. Changes here save straight away, as they do on Rules. */
const MerchantKeywordRules: React.FC<{ merchantName: string; category: string; description: string; transactions: Transaction[] }> = ({ merchantName, category, description, transactions }) => {
  const { preferences, setPreferences } = usePreferencesContext();
  const { saveTransaction } = useTransactionsContext();
  const [isAdding, setAdding] = useState(false);
  const [keyword, setKeyword] = useState('');

  const rules = useMemo(() => keywordRulesFor(preferences.transactionRules, merchantName), [preferences.transactionRules, merchantName]);
  const matches = transactionsWithKeyword(transactions, keyword).length;

  const setRules = (change: (rules: TransactionRule[]) => TransactionRule[]) =>
    setPreferences(prev => ({ ...prev, transactionRules: change(prev.transactionRules || []) }));

  const add = () => {
    const text = keyword.trim();
    setRules(list => [newKeywordRule(merchantName, text, category, description), ...list]);
    setKeyword('');
    setAdding(false);
    toast.success(`Added "${text}"`);
  };

  const applyToPast = (rule: TransactionRule) => {
    const found = transactionsWithKeyword(transactions, keywordOf(rule));
    saveTransaction(found.map(tx => ({ ...tx, merchant: merchantName, category: category || tx.category, description: description || tx.description })));
    toast.success(`Updated ${found.length} past ${found.length === 1 ? 'transaction' : 'transactions'}`);
  };

  const remove = (rule: TransactionRule) => {
    setRules(list => list.filter(item => item.id !== rule.id));
    toast.success(`Removed "${keywordOf(rule)}"`, { action: { label: 'Undo', onClick: () => setRules(list => [rule, ...list]) } });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-card-title text-ink">Matching keywords</h3>
        {!isAdding && <Button variant="ghost" size="sm" icon="add" onPress={() => setAdding(true)}>Add</Button>}
      </div>
      {isAdding && (
        <div className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-3">
          <TextInput
            autoFocus
            label="Text in the bank description"
            placeholder="UBER *EATS"
            value={keyword}
            onChange={setKeyword}
            help={keyword.trim() ? `Matches ${matches} past ${matches === 1 ? 'transaction' : 'transactions'}.` : undefined}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onPress={() => { setKeyword(''); setAdding(false); }}>Cancel</Button>
            <Button size="sm" isDisabled={!keyword.trim()} onPress={add}>Add keyword</Button>
          </div>
        </div>
      )}
      {rules.length === 0 && !isAdding && <p className="type-body text-muted">New bank transactions containing a keyword are filed under this merchant.</p>}
      {rules.length > 0 && (
        <ul className="divide-y divide-line">
          {rules.map(rule => {
            const text = keywordOf(rule);
            const count = transactionsWithKeyword(transactions, text).length;
            return (
              <li key={rule.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="type-body-strong truncate text-ink">{text || rule.name}</p>
                  <p className="type-caption text-muted">{count} past {count === 1 ? 'transaction' : 'transactions'}</p>
                </div>
                <Switch className="shrink-0 gap-0 max-md:w-auto" aria-label={`Use ${text || rule.name}`} isSelected={rule.isActive} onChange={() => setRules(list => list.map(item => item.id === rule.id ? { ...item, isActive: !item.isActive } : item))}>{''}</Switch>
                <Menu
                  title={text || rule.name}
                  trigger={<IconButton icon="more_horiz" label={`Actions for ${text || rule.name}`} tooltipPlacement="left" />}
                  items={[
                    ...(count > 0 ? [{ id: 'apply', label: `Apply to ${count} past`, icon: 'sync', onAction: () => applyToPast(rule) }] : []),
                    { id: 'delete', label: 'Delete', icon: 'delete', onAction: () => remove(rule) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default MerchantKeywordRules;
