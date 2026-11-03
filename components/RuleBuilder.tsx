import React, { useEffect, useMemo, useState } from 'react';
import { Category, RuleFieldAction, RuleFieldCondition, RuleOperator, Transaction, TransactionRule, TransactionRuleAction, TransactionRuleCondition } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { flattenCategories } from '../utils';
import { blankDraft, draftFromRule, FIELD_LABELS, findRuleProblem, matchingTransactions, OPERATOR_LABELS, operatorsFor, RULE_TEMPLATES, RuleDraft, ruleFromDraft } from '../utils/rulesModel';
import { Button, IconButton } from './ui/Actions';
import { TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox, Select } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

interface RuleBuilderProps {
  /** A rule to edit, a suggestion to adjust, or null for a new one. */
  rule: TransactionRule | null;
  rules: TransactionRule[];
  transactions: Transaction[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  onClose: () => void;
  onSave: (rule: TransactionRule, replacesId?: string) => void;
}

const CONDITION_FIELDS: RuleFieldCondition[] = ['description', 'merchant', 'amount', 'type', 'category', 'text'];
const ACTION_FIELDS: RuleFieldAction[] = ['category', 'merchant', 'description'];
const SAMPLE_COUNT = 3;

const titled = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const fieldOption = (field: string, label: string = field) => ({ id: field, label: titled(label) });

const RuleBuilder: React.FC<RuleBuilderProps> = ({ rule, rules, transactions, incomeCategories, expenseCategories, onClose, onSave }) => {
  const [isOpen, setOpen] = useState(true);
  const [draft, setDraft] = useState<RuleDraft>(() => (rule ? draftFromRule(rule) : blankDraft()));
  const [step, setStep] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<string | null>(null);
  const isPhone = useIsMobile();

  useEffect(() => setProblem(null), [draft]);

  const update = (changes: Partial<RuleDraft>) => setDraft(prev => ({ ...prev, ...changes }));
  const setCondition = (index: number, changes: Partial<TransactionRuleCondition>) =>
    update({ conditions: draft.conditions.map((condition, position) => (position === index ? { ...condition, ...changes } : condition)) });
  const setAction = (index: number, changes: Partial<TransactionRuleAction>) =>
    update({ actions: draft.actions.map((action, position) => (position === index ? { ...action, ...changes } : action)) });

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    return flattenCategories([...expenseCategories, ...incomeCategories])
      .filter(category => !seen.has(category.name) && !!seen.add(category.name))
      .map(category => ({ id: category.name, label: category.name, description: category.classification === 'income' ? 'Income' : 'Expense' }));
  }, [expenseCategories, incomeCategories]);
  const merchantOptions = useMemo(() => {
    const names = new Set(transactions.map(tx => tx.merchant?.trim()).filter(Boolean) as string[]);
    if (draft.merchant) names.add(draft.merchant);
    return [...names].sort((a, b) => a.localeCompare(b)).map(name => ({ id: name, label: name }));
  }, [draft.merchant, transactions]);

  const preview = useMemo(() => {
    if (findRuleProblem(draft)) return null;
    return matchingTransactions(ruleFromDraft(draft, rules), transactions);
  }, [draft, rules, transactions]);

  const close = () => { setOpen(false); onClose(); };
  const save = () => {
    const found = findRuleProblem(draft);
    if (found) return setProblem(found);
    onSave(ruleFromDraft(draft, rules), draft.id);
    close();
  };
  const useTemplate = (id: string) => {
    const template = RULE_TEMPLATES.find(item => item.id === id);
    if (!template) return;
    update({
      name: template.label,
      conditions: [{ field: 'description', operator: 'contains', value: template.keyword }],
      actions: [{ field: 'category', value: categoryOptions.some(option => option.id === template.category) ? template.category : '' }],
    });
  };

  const isSteps = isPhone && draft.kind === 'rule';
  const showWhen = !isSteps || step === 1;
  const showThen = !isSteps || step === 2;
  const hasSaved = !!draft.id && rules.some(item => item.id === draft.id);

  const whenValue = (condition: TransactionRuleCondition, index: number) => {
    if (condition.field === 'type') {
      return <Select label="Value" options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }]} value={condition.value || null} onChange={id => setCondition(index, { value: id })} />;
    }
    if (condition.field === 'category') {
      return <Combobox label="Value" options={categoryOptions} value={condition.value || null} onChange={id => setCondition(index, { value: id ?? '' })} />;
    }
    return <TextInput label="Value" inputMode={condition.field === 'amount' ? 'decimal' : undefined} value={condition.value} onChange={text => setCondition(index, { value: text })} />;
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      width={640}
      isDirty={JSON.stringify(draft) !== JSON.stringify(rule ? draftFromRule(rule) : blankDraft())}
      title={hasSaved ? 'Edit rule' : 'New rule'}
      description={isSteps ? `Step ${step} of 2` : undefined}
      footer={confirmClose => (
        <div className="space-y-2">
          {problem && <p role="alert" className="type-caption text-ink">{problem}</p>}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onPress={isSteps && step === 2 ? () => setStep(1) : confirmClose}>{isSteps && step === 2 ? 'Back' : 'Cancel'}</Button>
            {isSteps && step === 1 ? <Button onPress={() => setStep(2)}>Next</Button> : <Button onPress={save}>Save rule</Button>}
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        {!hasSaved && (
          <SegmentedControl
            items={[{ id: 'rule', label: 'Rule' }, { id: 'always', label: 'Always file' }]}
            activeId={draft.kind}
            onChange={id => update({ kind: id as RuleDraft['kind'] })}
          />
        )}

        {draft.kind === 'always' ? (
          <div className="space-y-4">
            <Combobox label="Merchant" options={merchantOptions} value={draft.merchant || null} onChange={id => update({ merchant: id ?? '' })} onCreate={text => update({ merchant: text })} />
            <Combobox label="File under" options={categoryOptions} value={draft.category || null} onChange={id => update({ category: id ?? '' })} />
            <TextInput label="Describe as (optional)" value={draft.description} onChange={text => update({ description: text })} />
            <p className="type-caption text-muted">This always wins for what it sets. Other rules can fill the rest.</p>
          </div>
        ) : (
          <>
            {showWhen && (
              <section className="space-y-3">
                {!hasSaved && !rule && (
                  <div>
                    <p className="type-label mb-1.5 text-ink">Start from</p>
                    <div className="flex flex-wrap gap-2">
                      {RULE_TEMPLATES.map(template => <Button key={template.id} variant="secondary" size="sm" onPress={() => useTemplate(template.id)}>{template.label}</Button>)}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="type-body-strong text-ink">When</h3>
                  {draft.conditions.length > 1 && (
                    <SegmentedControl items={[{ id: 'AND', label: 'All match' }, { id: 'OR', label: 'Any matches' }]} activeId={draft.conditionLogic} onChange={id => update({ conditionLogic: id as 'AND' | 'OR' })} />
                  )}
                </div>
                {draft.conditions.map((condition, index) => (
                  <div key={index} className="grid gap-2 rounded-[var(--radius-md)] border border-line p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                    <Select
                      label="Field"
                      options={CONDITION_FIELDS.map(field => fieldOption(field, FIELD_LABELS[field]))}
                      value={condition.field}
                      onChange={id => {
                        const field = id as RuleFieldCondition;
                        setCondition(index, { field, operator: operatorsFor(field)[0], value: '' });
                      }}
                    />
                    <Select
                      label="Test"
                      options={operatorsFor(condition.field).map(operator => fieldOption(operator, OPERATOR_LABELS[operator]))}
                      value={condition.operator}
                      onChange={id => setCondition(index, { operator: id as RuleOperator })}
                    />
                    {whenValue(condition, index)}
                    <IconButton icon="delete-02" label={`Remove condition ${index + 1}`} isDisabled={draft.conditions.length === 1} onPress={() => update({ conditions: draft.conditions.filter((_, position) => position !== index) })} />
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon="add-01" onPress={() => update({ conditions: [...draft.conditions, { field: 'description', operator: 'contains', value: '' }] })}>Add condition</Button>
              </section>
            )}

            {showThen && (
              <section className="space-y-3">
                <h3 className="type-body-strong text-ink">Then set</h3>
                {draft.actions.map((action, index) => (
                  <div key={index} className="grid gap-2 rounded-[var(--radius-md)] border border-line p-3 sm:grid-cols-[1fr_1.8fr_auto] sm:items-end">
                    <Select
                      label="Field"
                      options={ACTION_FIELDS.map(field => fieldOption(field))}
                      value={action.field}
                      onChange={id => setAction(index, { field: id as RuleFieldAction, value: '' })}
                    />
                    {action.field === 'category'
                      ? <Combobox label="To" options={categoryOptions} value={action.value || null} onChange={id => setAction(index, { value: id ?? '' })} />
                      : <TextInput label="To" value={action.value} onChange={text => setAction(index, { value: text })} />}
                    <IconButton icon="delete-02" label={`Remove action ${index + 1}`} isDisabled={draft.actions.length === 1} onPress={() => update({ actions: draft.actions.filter((_, position) => position !== index) })} />
                  </div>
                ))}
                {draft.actions.length < ACTION_FIELDS.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="add-01"
                    onPress={() => update({ actions: [...draft.actions, { field: ACTION_FIELDS.find(field => !draft.actions.some(action => action.field === field)) ?? 'category', value: '' }] })}
                  >
                    Add action
                  </Button>
                )}
                <TextInput label="Name (optional)" value={draft.name} onChange={text => update({ name: text })} />
              </section>
            )}
          </>
        )}

        {showThen && preview && (
          <div className="rounded-[var(--radius-md)] bg-inset p-3">
            <p className="type-label text-ink">Matches {preview.length} {preview.length === 1 ? 'transaction' : 'transactions'}</p>
            {preview.slice(0, SAMPLE_COUNT).map(tx => <p key={tx.id} className="type-caption mt-1 truncate text-muted">{tx.date} · {tx.merchant || tx.description}</p>)}
          </div>
        )}
      </div>
    </SidePanel>
  );
};

export default RuleBuilder;
