import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Account, BillPayment, Category, RecurrenceFrequency, RecurringTransaction, WeekendAdjustment, Transaction } from '../types';
import { FREQUENCIES, LIQUID_ACCOUNT_TYPES, WEEKEND_ADJUSTMENTS } from '../constants';
import { formatCurrency } from '../utils';
import { draftFromBill, draftFromSeries, emptySeriesDraft, planSeries, type SeriesDraft } from '../utils/scheduleModel';
import { withFiling } from '../utils/rules';
import { Button, IconButton } from './ui/Actions';
import { DateInput, Switch, TextInput, controlStyles } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox, Select, type PickerOption } from './ui/Pickers';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowDataTransferHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';
import { AmountPad } from './ui/AmountPad';
import { LogoTile } from './EntityIcon';
import CategoryPicker from './CategoryPicker';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';
import { getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import { matchMerchants, merchantSuggestions, ruleFor } from '../utils/transactionForm';
import { suggestCategories } from '../utils/overviewSummary';
import { usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { useCategoryContext } from '../contexts/FinancialDataContext';

export interface RecurringTransactionModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave?: (transaction: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
  onSaveBill?: (bill: Omit<BillPayment, 'id'> & { id?: string }) => void;
  accounts: Account[];
  incomeCategories?: Category[];
  expenseCategories?: Category[];
  recurringTransactionToEdit?: (Omit<RecurringTransaction, 'id'> & { id?: string }) | null;
  billToEdit?: (Omit<BillPayment, 'id'> & { id?: string }) | null;
  initialMode?: 'recurring' | 'one-time';
  initialDate?: string;
}

const KINDS: SwipeTabItem[] = [{ id: 'recurring', title: 'Recurring' }, { id: 'bill', title: 'One-time' }];
const RECURRING_TYPES: SwipeTabItem[] = [
  {
    id: 'expense',
    title: 'Payment',
    icon: () => <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-money-out',
    activeTextColor: 'text-on-danger',
  },
  {
    id: 'income',
    title: 'Income',
    icon: () => <HugeiconsIcon icon={ArrowUp01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-money-in',
    activeTextColor: 'text-on-primary',
  },
  {
    id: 'transfer',
    title: 'Transfer',
    icon: () => <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={16} className="shrink-0" />,
    activeColor: 'bg-pill',
    activeTextColor: 'text-on-pill',
  },
];
const BILL_TYPES = RECURRING_TYPES.slice(0, 2);
const NONE = 'none';

const initialDraft = (props: RecurringTransactionModalProps): SeriesDraft => {
  const { billToEdit, recurringTransactionToEdit, accounts, initialDate, initialMode } = props;
  if (billToEdit) return draftFromBill(billToEdit as BillPayment);
  if (recurringTransactionToEdit) return draftFromSeries(recurringTransactionToEdit as RecurringTransaction);
  const draft = emptySeriesDraft(accounts[0]?.id ?? '', accounts[0]?.currency ?? 'EUR', new Date());
  return {
    ...draft,
    kind: initialMode === 'one-time' ? 'bill' : 'recurring',
    startDate: initialDate || draft.startDate,
    accountId: initialMode === 'one-time' ? '' : draft.accountId,
  };
};

/** The recurring and one-time form matching the Add Transaction design system. */
const RecurringTransactionModal: React.FC<RecurringTransactionModalProps> = props => {
  const {
    onClose,
    onSave,
    onSaveBill,
    accounts,
    incomeCategories = [],
    expenseCategories = [],
    recurringTransactionToEdit,
    billToEdit,
  } = props;

  const initial = useRef(initialDraft(props));
  const [draft, setDraft] = useState<SeriesDraft>(initial.current);
  const [errors, setErrors] = useState<{ amount?: string; account?: string; category?: string; description?: string }>({});
  useEffect(() => { setErrors({}); }, [draft]);

  const [isMerchantOpen, setMerchantOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const transactions = useTransactionSelector(t => t);
  const savedMerchantRules = usePreferencesSelector(p => p.merchantRules);
  const savedTransactionRules = usePreferencesSelector(p => p.transactionRules);
  const transactionRules = useMemo(() => savedTransactionRules ?? [], [savedTransactionRules]);
  const merchantRules = useMemo(() => withFiling(savedMerchantRules, transactionRules), [savedMerchantRules, transactionRules]);
  const userDateFormat = usePreferencesSelector(p => p.dateFormat);
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const categoryContext = useCategoryContext();
  const resolvedIncomeCategories = incomeCategories.length ? incomeCategories : (categoryContext?.incomeCategories ?? []);
  const resolvedExpenseCategories = expenseCategories.length ? expenseCategories : (categoryContext?.expenseCategories ?? []);

  const update = (patch: Partial<SeriesDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const isEditing = !!(recurringTransactionToEdit?.id || billToEdit?.id);
  const isBill = draft.kind === 'bill';
  const isTransfer = draft.type === 'transfer';
  const usesDay = draft.frequency === 'monthly' || draft.frequency === 'yearly';

  const selectedAccount = accounts.find(a => a.id === (draft.type === 'income' ? (draft.accountId || draft.toAccountId) : draft.accountId));
  const currency = selectedAccount?.currency ?? draft.currency ?? accounts[0]?.currency ?? 'EUR';

  // Merchant autocomplete suggestions
  const allMerchants = useMemo(() => merchantSuggestions(transactions, merchantRules), [transactions, merchantRules]);
  const merchantMatches = useMemo(() => (isMerchantOpen ? matchMerchants(allMerchants, draft.merchant) : []), [isMerchantOpen, allMerchants, draft.merchant]);

  const merchantLogo = useMemo(() => {
    const name = draft.merchant.trim();
    if (!name) return null;
    return getMerchantLogoUrl(name, brandfetchClientId, logoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 64,
      height: 64,
    });
  }, [draft.merchant, brandfetchClientId, logoOverrides]);

  const pickMerchant = (name: string, category?: string) => {
    update({
      merchant: name,
      ...(draft.description ? {} : { description: name }),
      ...(category && !draft.category ? { category } : {}),
    });
    setMerchantOpen(false);
    setActiveIndex(-1);
  };

  const onMerchantKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isMerchantOpen || merchantMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(index => (index < merchantMatches.length - 1 ? index + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(index => (index > 0 ? index - 1 : merchantMatches.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickMerchant(merchantMatches[activeIndex].name, merchantMatches[activeIndex].category);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setMerchantOpen(false);
    }
  };

  // Account options with LogoTiles and sorted by account type
  const ACCOUNT_TYPE_ORDER = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending', 'Credit Card', 'Loan', 'Other Liabilities'];
  const rank = (type: string) => {
    const i = ACCOUNT_TYPE_ORDER.indexOf(type);
    return i === -1 ? ACCOUNT_TYPE_ORDER.length : i;
  };

  const accountOptions = (exclude?: string, selected?: string): PickerOption[] => {
    const filtered = accounts.filter(item =>
      item.id !== exclude &&
      (isBill ? LIQUID_ACCOUNT_TYPES.includes(item.type) : item.status !== 'closed' || item.id === selected || item.id === draft.accountId || item.id === draft.toAccountId)
    );
    const open = filtered.filter(a => a.status !== 'closed').sort((a, b) => rank(a.type) - rank(b.type));
    const closed = filtered.filter(a => a.status === 'closed');
    const sorted = [...open, ...closed];

    const mapped = sorted.map(item => {
      const logoUrl = item.imageUrl
        || getAccountBrandfetchUrl(item, brandfetchClientId, logoOverrides)
        || (item.financialInstitution ? getMerchantLogoUrl(item.financialInstitution, brandfetchClientId, logoOverrides) : null);
      return {
        id: item.id,
        label: item.name,
        description: `${item.financialInstitution || item.type}, ${formatCurrency(item.balance, item.currency)}`,
        group: item.status === 'closed' ? 'Closed' : item.type,
        visual: <LogoTile url={logoUrl} label={item.name} size={24} fallbackIcon="account_balance" />,
      };
    });

    if (isBill) {
      return [
        {
          id: NONE,
          label: 'No account',
          description: 'Unassigned',
          visual: <LogoTile label="None" size={24} fallbackIcon="wallet-02" />,
        },
        ...mapped,
      ];
    }
    return mapped;
  };

  // Categories & suggestion pills
  const categories = draft.type === 'income' ? resolvedIncomeCategories : resolvedExpenseCategories;
  const categoryChoices = useMemo<Category[]>(
    () => (draft.type === 'transfer' ? [{ id: 'transfer', name: 'Transfer', subCategories: [] } as unknown as Category, ...categories] : categories),
    [draft.type, categories]
  );
  const activeRule = ruleFor(draft.merchant, merchantRules);
  const suggestions = useMemo(() => (draft.type === 'transfer' ? [] : suggestCategories(
    { merchant: draft.merchant, description: draft.description, type: draft.type } as Transaction,
    transactions,
    activeRule?.category
  )), [draft.type, draft.merchant, draft.description, transactions, activeRule?.category]);

  const setKind = (kind: string) => update({ kind: kind as SeriesDraft['kind'], type: draft.type === 'transfer' ? 'expense' : draft.type });

  const handleSave = () => {
    const num = parseFloat(draft.amount);
    if (!draft.amount || isNaN(num) || num <= 0) {
      setErrors(prev => ({ ...prev, amount: 'Enter an amount' }));
      toast.error('Enter an amount');
      return;
    }
    if (!draft.description.trim() && !draft.merchant.trim()) {
      setErrors(prev => ({ ...prev, description: 'Enter a name or merchant' }));
      toast.error('Enter a name or merchant');
      return;
    }
    if (isTransfer) {
      if (!draft.accountId) {
        setErrors(prev => ({ ...prev, account: 'Choose an account to transfer from' }));
        toast.error('Choose an account to transfer from');
        return;
      }
      if (!draft.toAccountId) {
        setErrors(prev => ({ ...prev, account: 'Choose an account to transfer to' }));
        toast.error('Choose an account to transfer to');
        return;
      }
      if (draft.accountId === draft.toAccountId) {
        setErrors(prev => ({ ...prev, account: 'Choose two different accounts' }));
        toast.error('Choose two different accounts');
        return;
      }
    } else if (!isBill && !draft.accountId) {
      setErrors(prev => ({ ...prev, account: 'Choose an account' }));
      toast.error('Choose an account');
      return;
    }
    if (!isBill && !isTransfer && !draft.category) {
      setErrors(prev => ({ ...prev, category: 'Choose a category' }));
      toast.error('Choose a category');
      return;
    }

    const finalDescription = draft.description.trim() || draft.merchant.trim();
    const finalDraft = { ...draft, description: finalDescription, currency };
    const plan = planSeries(finalDraft, recurringTransactionToEdit?.id || billToEdit?.id, billToEdit as BillPayment | undefined);
    if ('error' in plan) {
      toast.error(plan.error);
      return;
    }
    if (plan.kind === 'bill') onSaveBill?.(plan.bill);
    else onSave?.({ ...(recurringTransactionToEdit ?? {}), ...plan.series });
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${draft.description || 'item'}` : isBill ? 'New one-time item' : 'New recurring item'}
      isDirty={JSON.stringify(draft) !== JSON.stringify(initial.current)}
      footer={close => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button onPress={handleSave}>{isEditing ? 'Save changes' : 'Save'}</Button>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        {!isEditing && (
          <SmoothTab
            fullWidth
            className="w-full"
            items={KINDS}
            value={draft.kind}
            onChange={setKind}
            label="Transaction recurrence"
          />
        )}
        <SmoothTab
          fullWidth
          className="w-full"
          items={isBill ? BILL_TYPES : RECURRING_TYPES}
          value={draft.type}
          onChange={type => update({ type: type as SeriesDraft['type'], ...(isEditing ? {} : { category: '' }) })}
          label="Transaction type"
        />

        {/* 1. Amount: Exact same hero AmountPad as Add Transaction */}
        <div>
          <div className="type-label mb-1.5 flex items-center justify-between text-muted">
            <span>Amount</span>
          </div>
          <AmountPad
            autoFocus
            currency={currency}
            value={draft.amount}
            onChange={amount => update({ amount })}
            onBlur={() => {
              const num = parseFloat(draft.amount);
              if (!isNaN(num) && num > 0) update({ amount: num.toFixed(2) });
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {errors.amount && <p role="alert" className="type-caption mt-1.5 text-money-out">{errors.amount}</p>}
        </div>

        {/* 2. Merchant: Exact same LogoTile preview, input, clear button & suggestions dropdown */}
        <div className="relative">
          <label htmlFor="bill-merchant" className="type-label mb-1.5 block text-ink">Merchant</label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3 z-10 flex size-6 shrink-0 items-center justify-center">
              {draft.merchant.trim() ? (
                <LogoTile
                  url={merchantLogo}
                  label={draft.merchant}
                  size={24}
                  rounded="md"
                  fallbackIcon={draft.type === 'transfer' ? 'arrow-data-transfer-horizontal' : 'store-01'}
                />
              ) : (
                <Icon
                  name={draft.type === 'transfer' ? 'arrow-data-transfer-horizontal' : 'store-01'}
                  size={18}
                  className="text-muted"
                />
              )}
            </span>
            <input
              id="bill-merchant"
              role="combobox"
              aria-expanded={isMerchantOpen && merchantMatches.length > 0}
              aria-controls="bill-merchant-list"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `bill-merchant-${activeIndex}` : undefined}
              autoComplete="off"
              value={draft.merchant}
              placeholder={draft.type === 'transfer' ? 'Internal Transfer' : 'Shop, company or person'}
              onChange={e => {
                const { value } = e.target;
                setMerchantOpen(true);
                update({ merchant: value });
              }}
              onFocus={() => { setMerchantOpen(true); setActiveIndex(-1); }}
              onBlur={() => {
                // Short timeout to allow clicking dropdown items
                setTimeout(() => setMerchantOpen(false), 200);
              }}
              onKeyDown={onMerchantKey}
              className={cn(controlStyles, 'h-11 pl-11 pr-9 text-[.9375rem] font-medium max-md:h-12 max-md:text-base')}
            />
            {draft.merchant.trim() && (
              <button
                type="button"
                aria-label="Clear merchant"
                onMouseDown={e => {
                  e.preventDefault();
                  update({ merchant: '' });
                }}
                className="absolute right-3 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          {isMerchantOpen && merchantMatches.length > 0 && (
            <ul
              id="bill-merchant-list"
              role="listbox"
              aria-label="Merchants"
              className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-solid p-1.5 shadow-sm"
            >
              {merchantMatches.map((item, index) => {
                const logo = getMerchantLogoUrl(item.name, brandfetchClientId, logoOverrides, {
                  fallback: 'lettermark',
                  type: 'icon',
                  width: 64,
                  height: 64,
                });
                return (
                  <li key={item.name} id={`bill-merchant-${index}`} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pickMerchant(item.name, item.category)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-left pointer-coarse:min-h-12',
                        index === activeIndex && 'bg-inset'
                      )}
                    >
                      <LogoTile url={logo} label={item.name} size={24} fallbackIcon="storefront" />
                      <span className="type-body min-w-0 flex-1 truncate text-ink">{item.name}</span>
                      {item.category && <span className="type-caption shrink-0 text-muted">{item.category}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 3. Account: Exact same Combobox layout, From/To swap for transfers, and LogoTile visuals */}
        {isTransfer ? (
          <div className="flex items-end gap-1 max-md:flex-col max-md:items-stretch">
            <Combobox
              className="min-w-0 flex-1 max-md:flex-none"
              label="From"
              error={errors.account}
              options={accountOptions(draft.toAccountId, draft.accountId)}
              value={draft.accountId || null}
              onChange={id => update({ accountId: id ?? '' })}
              placeholder="Search accounts"
            />
            <IconButton
              className="max-md:self-end"
              icon="arrow-data-transfer-horizontal"
              label="Swap accounts"
              onPress={() => update({ accountId: draft.toAccountId, toAccountId: draft.accountId })}
            />
            <Combobox
              className="min-w-0 flex-1 max-md:flex-none"
              label="To"
              error={errors.account}
              options={accountOptions(draft.accountId, draft.toAccountId)}
              value={draft.toAccountId || null}
              onChange={id => update({ toAccountId: id ?? '' })}
              placeholder="Search accounts"
            />
          </div>
        ) : (
          <Combobox
            label="Account"
            error={errors.account}
            options={accountOptions(undefined, draft.accountId)}
            value={draft.accountId || (isBill ? NONE : null)}
            onChange={id => update({ accountId: (id === NONE || !id) ? '' : id })}
            placeholder="Search accounts"
          />
        )}

        {/* Dates */}
        {isBill ? (
          <DateInput
            label="Due date"
            value={draft.startDate}
            onChange={startDate => update({ startDate })}
            dateFormat={userDateFormat}
            isRequired
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <DateInput
              label="Starts"
              value={draft.startDate}
              onChange={startDate => update({ startDate })}
              dateFormat={userDateFormat}
              isRequired
            />
            <DateInput
              label="Ends"
              value={draft.endDate}
              onChange={endDate => update({ endDate })}
              dateFormat={userDateFormat}
            />
          </div>
        )}

        {/* 4. Category: Exact same CategoryPicker with suggestions, category tree and colors */}
        {!isTransfer && (
          <CategoryPicker
            categories={categoryChoices}
            suggestions={suggestions}
            value={draft.category || null}
            error={errors.category}
            onChange={category => update({ category })}
          />
        )}

        {/* Description: Name / note */}
        <TextInput
          label="Description"
          error={errors.description}
          value={draft.description}
          placeholder={draft.type === 'transfer' ? 'What is this transfer for?' : 'What is this for?'}
          onChange={description => update({ description })}
          onBlur={() => {
            if (!draft.merchant && draft.description) update({ merchant: draft.description });
          }}
        />

        {/* Recurrence schedule settings for recurring items */}
        {!isBill && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="How often"
                options={FREQUENCIES.map(item => ({ id: item.value, label: item.label }))}
                value={draft.frequency}
                onChange={id => update({ frequency: id as RecurrenceFrequency, ...(id === 'daily' ? { frequencyInterval: '1' } : {}) })}
              />
              {draft.frequency !== 'daily' && (
                <TextInput
                  label="Every"
                  inputMode="numeric"
                  value={draft.frequencyInterval}
                  onChange={frequencyInterval => update({ frequencyInterval })}
                />
              )}
            </div>
            {usesDay && (
              <TextInput
                label="Day of the month"
                inputMode="numeric"
                value={draft.dueDateOfMonth}
                onChange={dueDateOfMonth => update({ dueDateOfMonth })}
                help="Optional. Leave it blank to use the start date."
              />
            )}
            <Select
              label="If it lands on a weekend"
              options={WEEKEND_ADJUSTMENTS.map(item => ({ id: item.value, label: item.label }))}
              value={draft.weekendAdjustment}
              onChange={id => update({ weekendAdjustment: id as WeekendAdjustment })}
            />
            {draft.type !== 'income' && (
              <>
                <Switch isSelected={draft.autopay} onChange={autopay => update({ autopay })}>
                  Pays itself (autopay)
                </Switch>
                <TextInput
                  label="Payment link"
                  inputMode="url"
                  value={draft.paymentUrl}
                  onChange={paymentUrl => update({ paymentUrl })}
                  help="Optional. Where you pay or manage it online."
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label="Remind me (days before)"
                    inputMode="numeric"
                    value={draft.notifyDaysBefore}
                    onChange={notifyDaysBefore => update({ notifyDaysBefore })}
                    help="Default 3."
                  />
                  <TextInput
                    label="Grace period (days)"
                    inputMode="numeric"
                    value={draft.overdueGraceDays}
                    onChange={overdueGraceDays => update({ overdueGraceDays })}
                    help="Overdue only after this."
                  />
                </div>
                <DateInput
                  label="Free trial ends"
                  value={draft.trialEndsOn}
                  onChange={trialEndsOn => update({ trialEndsOn })}
                  dateFormat={userDateFormat}
                />
              </>
            )}
          </>
        )}
      </form>
    </SidePanel>
  );
};

export default RecurringTransactionModal;
