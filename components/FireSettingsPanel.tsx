import React, { useEffect, useMemo, useState } from 'react';
import type { Account } from '../types';
import { formatCurrency, getMainCurrency } from '../utils';
import { defaultFireAccounts, normalizeFireSettings, type FireSettings } from '../utils/fireModel';
import { Button } from './ui/Actions';
import { AmountInput, Checkbox, Radio, RadioGroup, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';

interface FireSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FireSettings;
  /** Every account that could count (open and in analytics). */
  accounts: Account[];
  /** What the last 12 months say, to show beside the choice to use them. */
  actualAnnualExpenses: number;
  actualMonthlySaving: number;
  onSave: (settings: FireSettings) => void;
}

const parse = (text: string) => {
  const value = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
};
const percentText = (fraction: number) => String(Math.round(fraction * 10000) / 100);

/** The numbers FIRE rests on. Each is a choice, so each is explained where it is chosen. */
const FireSettingsPanel: React.FC<FireSettingsPanelProps> = ({ isOpen, onClose, settings, accounts, actualAnnualExpenses, actualMonthlySaving, onSave }) => {
  const currency = getMainCurrency();
  const defaults = useMemo(() => new Set(defaultFireAccounts(accounts).map(account => account.id)), [accounts]);

  const [withdrawal, setWithdrawal] = useState('');
  const [growth, setGrowth] = useState('');
  const [expenseMode, setExpenseMode] = useState<'actual' | 'manual'>('actual');
  const [expenses, setExpenses] = useState('');
  const [savingMode, setSavingMode] = useState<'actual' | 'manual'>('actual');
  const [saving, setSaving] = useState('');
  const [age, setAge] = useState('');
  const [retireAt, setRetireAt] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  // Start from what is saved each time the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    setWithdrawal(percentText(settings.withdrawalRate));
    setGrowth(percentText(settings.expectedReturn));
    setExpenseMode(settings.expenses.mode);
    setExpenses(settings.expenses.manualAnnual !== undefined ? String(settings.expenses.manualAnnual) : '');
    setSavingMode(settings.contribution.mode);
    setSaving(settings.contribution.manualMonthly !== undefined ? String(settings.contribution.manualMonthly) : '');
    setAge(settings.currentAge !== undefined ? String(settings.currentAge) : '');
    setRetireAt(settings.retirementAge !== undefined ? String(settings.retirementAge) : '');
    setChosen(new Set(settings.accountIds ?? [...defaults]));
  }, [isOpen, settings, defaults]);

  const errors = {
    withdrawal: Number.isNaN(parse(withdrawal)) || parse(withdrawal) < 2 || parse(withdrawal) > 10 ? 'Enter a rate between 2 and 10.' : undefined,
    growth: Number.isNaN(parse(growth)) || parse(growth) < 0 || parse(growth) > 15 ? 'Enter a return between 0 and 15.' : undefined,
    expenses: expenseMode === 'manual' && !(parse(expenses) > 0) ? 'Enter your yearly spending.' : undefined,
    saving: savingMode === 'manual' && Number.isNaN(parse(saving)) ? 'Enter a monthly amount.' : undefined,
    age: age.trim() && !(parse(age) >= 16 && parse(age) <= 100) ? 'Enter an age from 16 to 100.' : undefined,
    retireAt: retireAt.trim() && !(parse(retireAt) >= 16 && parse(retireAt) <= 100) ? 'Enter an age from 16 to 100.'
      : retireAt.trim() && age.trim() && parse(retireAt) <= parse(age) ? 'Choose an age after your current one.' : undefined,
    accounts: chosen.size === 0 ? 'Choose at least one account.' : undefined,
  };
  const hasError = Object.values(errors).some(Boolean);

  const save = () => {
    if (hasError) return;
    const sameAsDefault = chosen.size === defaults.size && [...chosen].every(id => defaults.has(id));
    onSave(normalizeFireSettings({
      withdrawalRate: parse(withdrawal) / 100,
      expectedReturn: parse(growth) / 100,
      expenses: expenseMode === 'manual' ? { mode: 'manual', manualAnnual: parse(expenses) } : { mode: 'actual' },
      contribution: savingMode === 'manual' ? { mode: 'manual', manualMonthly: parse(saving) } : { mode: 'actual' },
      accountIds: sameAsDefault ? undefined : [...chosen],
      currentAge: age.trim() ? parse(age) : undefined,
      retirementAge: retireAt.trim() ? parse(retireAt) : undefined,
    }));
    onClose();
  };

  const toggle = (id: string, on: boolean) => setChosen(previous => { const next = new Set(previous); if (on) next.add(id); else next.delete(id); return next; });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="FIRE settings"
      description="These choices set your FI number and your date. Change them and see what moves."
      footer={close => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={hasError} onPress={save}>Save</Button>
        </div>
      )}
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="type-card-title text-ink">The target</h3>
          <TextInput label="Withdrawal rate (%)" inputMode="decimal" value={withdrawal} onChange={setWithdrawal} error={errors.withdrawal}
            help="The share of your portfolio you expect to spend each year. 4% is the usual rule of thumb. A lower rate, such as 3.25%, is safer for a very long retirement and needs a bigger portfolio." />
          <RadioGroup label="Yearly spending in independence" value={expenseMode} onChange={value => setExpenseMode(value as 'actual' | 'manual')}>
            <Radio value="actual">What I spent in the last 12 months{actualAnnualExpenses > 0 ? ` (${formatCurrency(actualAnnualExpenses, currency)} a year)` : ''}</Radio>
            <Radio value="manual">A number I choose</Radio>
          </RadioGroup>
          {expenseMode === 'manual' && <AmountInput label="Yearly spending" currency={currency} value={expenses} onChange={setExpenses} error={errors.expenses} help="What you expect to spend each year once you stop working, in today's money." />}
        </section>

        <section className="space-y-4">
          <h3 className="type-card-title text-ink">The journey</h3>
          <TextInput label="Expected return after inflation (%)" inputMode="decimal" value={growth} onChange={setGrowth} error={errors.growth}
            help="A real return, so everything stays in today's money. 4 to 5% is a common assumption for a stock-heavy portfolio. The page also shows the result two points higher and lower." />
          <RadioGroup label="What you add each month" value={savingMode} onChange={value => setSavingMode(value as 'actual' | 'manual')}>
            <Radio value="actual">What I have saved lately{actualMonthlySaving !== 0 ? ` (${formatCurrency(actualMonthlySaving, currency)} a month)` : ''}</Radio>
            <Radio value="manual">A number I choose</Radio>
          </RadioGroup>
          {savingMode === 'manual' && <AmountInput label="Monthly saving" currency={currency} value={saving} onChange={setSaving} error={errors.saving} help="What goes into the counted accounts each month, in today's money." />}
        </section>

        <section className="space-y-4">
          <h3 className="type-card-title text-ink">Coast FI (optional)</h3>
          <p className="type-caption text-muted">Coast FI is the amount that grows into your FI number by the age you want to retire, with no more saving. Give both ages to see it.</p>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Your age" inputMode="numeric" value={age} onChange={setAge} error={errors.age} />
            <TextInput label="Retire at" inputMode="numeric" value={retireAt} onChange={setRetireAt} error={errors.retireAt} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="type-card-title text-ink">Accounts that count</h3>
          <p className="type-caption text-muted">Cash, savings and investments by default. A home or a car is not money you can spend, so it is left out unless you add it. Debts are not subtracted.</p>
          {errors.accounts && <p className="type-caption text-money-out" role="alert">{errors.accounts}</p>}
          <ul className="divide-y divide-line">
            {accounts.map(account => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-2">
                <Checkbox isSelected={chosen.has(account.id)} onChange={on => toggle(account.id, on)}>
                  <span className="type-body text-ink">{account.name}</span>
                  <span className="type-caption ml-2 text-muted">{account.type}</span>
                </Checkbox>
                <span className="type-caption shrink-0 text-muted tabular-nums">{formatCurrency(account.balance, account.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SidePanel>
  );
};

export default FireSettingsPanel;
