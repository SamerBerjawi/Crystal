import React, { useEffect, useMemo, useRef, useState } from 'react';
import { withFiling } from '../utils/rules';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Account, Category, MerchantLocation, Tag, Transaction, User } from '../types';
import { CATEGORY_TAG_PRESET_COLORS } from '../constants';
import { usePreferencesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { useTagsContext } from '../contexts/FinancialDataContext';
import type { AddressData } from '../hooks/useAddressSearch';
import { formatCurrency, currencySign } from '../utils';
import { getAccountBrandfetchUrl, getMerchantLogoUrl } from '../utils/brandfetch';
import { parseLocationString } from '../utils/locationDetector';
import { formatTransactionLocation } from '../utils/locationFormat';
import { suggestCategories } from '../utils/overviewSummary';
import {
  NO_BRANCH_MERCHANTS, accountsForType, autofill, branchesFor, clearedLocation, editLoanPart, initialTxForm, loanAccountFor, locationFromBranch, matchMerchants, merchantSuggestions,
  mergeBranch, planTransactionSave, roundUpFor, ruleFor, spareAccountFor, withAutoLoanSplit, type AutofillForce, type TxDraftSave, type TxForm, type TxInitial, type TxType,
} from '../utils/transactionForm';
import AddressAutocomplete from './AddressAutocomplete';
import CategoryPicker from './CategoryPicker';
import { LogoTile } from './EntityIcon';
import Icon from './ui/Icon';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { AmountInput, DateInput, Radio, RadioGroup, Switch, Textarea, TextInput, controlStyles } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox, Select, type PickerOption } from './ui/Pickers';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDataTransferHorizontalIcon,
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
} from '@hugeicons/core-free-icons';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';
import { AmountPad } from './ui/AmountPad';
import { cn } from '../lib/utils';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (transactionsToSave: TxDraftSave[], idsToDelete: string[]) => void;
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions?: Transaction[];
  transactionToEdit?: Transaction | null;
  initialType?: TxType;
  initialFromAccountId?: string;
  initialToAccountId?: string;
  initialCategory?: string;
  tags: Tag[];
  userProfile?: User;
  initialDetails?: TxInitial;
}

const TRANSACTION_TYPE_TABS: SwipeTabItem[] = [
  {
    id: 'expense',
    title: 'Expense',
    icon: () => <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} className="shrink-0" />,
    activeColor: 'bg-money-out',
    activeTextColor: 'text-on-danger',
  },
  {
    id: 'income',
    title: 'Income',
    icon: () => <HugeiconsIcon icon={ArrowDownLeft01Icon} size={16} className="shrink-0" />,
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

/** A closed section with a one-line summary of what's in it. */
const Expander: React.FC<{ title: string; summary?: React.ReactNode; children: React.ReactNode }> = ({ title, summary, children }) => {
  const [isOpen, setOpen] = useState(false);
  return (
    <section className="border-t border-line">
      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open => !open)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left">
        <span className="type-body-strong text-ink">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted">
          {summary && <span className="type-caption flex items-center gap-1.5 truncate">{summary}</span>}
          <Icon name="expand_more" size={20} className={cn('shrink-0 transition-transform duration-[var(--duration-base)]', isOpen && 'rotate-180')} />
        </span>
      </button>
      {isOpen && <div className="space-y-3 pb-4">{children}</div>}
    </section>
  );
};

const TagPicker: React.FC<{ tags: Tag[]; selected: string[]; onChange: (ids: string[]) => void; saveTag?: (tag: Omit<Tag, 'id'> & { id?: string }) => void }> = ({ tags, selected, onChange, saveTag }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_TAG_PRESET_COLORS[0]);

  const create = () => {
    const clean = name.trim().replace(/^#/, '');
    if (!clean || !saveTag) return;
    const id = uuidv4();
    saveTag({ id, name: clean, color, icon: 'label' });
    onChange([...selected, id]);
    toast.success(`Created the tag ${clean}`);
    setName('');
  };

  return (
    <div className="space-y-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
          {tags.map(tag => {
            const isOn = selected.includes(tag.id);
            return (
              <button key={tag.id} type="button" aria-pressed={isOn} onClick={() => onChange(isOn ? selected.filter(id => id !== tag.id) : [...selected, tag.id])} className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-bold text-ink pointer-coarse:h-11', isOn ? 'border-primary bg-primary-soft' : 'border-line-strong hover:bg-inset')}>
                <Icon name={tag.icon || 'tag'} size={14} style={{ color: tag.color }} className="shrink-0" />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
      {saveTag && (
        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <TextInput className="min-w-0 flex-1" label="New tag" value={name} onChange={setName} />
            <Button variant="secondary" isDisabled={!name.trim()} onPress={create}>Add</Button>
          </div>
          <div className="flex flex-wrap" role="group" aria-label="Tag colour">
            {CATEGORY_TAG_PRESET_COLORS.slice(0, 6).map(preset => (
              <button key={preset} type="button" aria-label={`Colour ${preset}`} aria-pressed={color === preset} onClick={() => setColor(preset)} className="flex size-8 pointer-coarse:size-11 cursor-pointer items-center justify-center pointer-coarse:size-11">
                <span aria-hidden="true" className={cn('size-6 rounded-full border-2', color === preset ? 'border-ink' : 'border-transparent')} style={{ backgroundColor: preset }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** The quick transaction form (D-022): the essentials first, with location, tags, notes and round-up tucked away. */
const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, accounts, incomeCategories, expenseCategories, transactions = [], transactionToEdit, initialType, initialFromAccountId, initialToAccountId, initialCategory, tags = [], userProfile, initialDetails }) => {
  const isEditing = !!transactionToEdit;
  const { setPreferences } = usePreferencesContext();
  const tagsContext = useTagsContext();
  const savedMerchantRules = usePreferencesSelector(p => p.merchantRules);
  const savedTransactionRules = usePreferencesSelector(p => p.transactionRules);
  const userDateFormat = usePreferencesSelector(p => p.dateFormat);
  const transactionRules = useMemo(() => savedTransactionRules ?? [], [savedTransactionRules]);
  const merchantRules = useMemo(() => withFiling(savedMerchantRules, transactionRules), [savedMerchantRules, transactionRules]);
  const brandfetchClientId = usePreferencesSelector(p => p.brandfetchClientId || '');
  const logoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const ruleContext = { merchantRules, transactionRules };

  const initial = useRef<TxForm | null>(null);
  if (!initial.current) {
    initial.current = withAutoLoanSplit(initialTxForm({
      edit: transactionToEdit, type: initialType, fromAccountId: initialFromAccountId, toAccountId: initialToAccountId, category: initialCategory, details: initialDetails, defaultCity: userProfile?.defaultCity?.trim(),
    }, { accounts, transactions, ...ruleContext }), accounts);
  }
  const [form, setForm] = useState<TxForm>(initial.current);
  const [errors, setErrors] = useState<{ amount?: string; account?: string; category?: string; description?: string }>({});
  useEffect(() => { setErrors({}); }, [form]);
  const [isMerchantOpen, setMerchantOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showManualLocation, setShowManualLocation] = useState(false);

  const update = (patch: Partial<TxForm>) => setForm(prev => withAutoLoanSplit({ ...prev, ...patch }, accounts));

  const applyAutofill = (next: TxForm, force?: AutofillForce) => withAutoLoanSplit({ ...next, ...autofill(next, ruleContext, force) }, accounts);

  const pickMerchant = (name: string) => {
    setForm(prev => applyAutofill({ ...prev, merchant: name, descriptionEdited: false, categoryEdited: false, locationEdited: false }, { description: true, category: true, location: true }));
    setMerchantOpen(false);
    setActiveIndex(-1);
  };

  const allMerchants = useMemo(() => merchantSuggestions(transactions, merchantRules), [transactions, merchantRules]);
  const merchantMatches = useMemo(() => (isMerchantOpen ? matchMerchants(allMerchants, form.merchant) : []), [isMerchantOpen, allMerchants, form.merchant]);
  const activeRule = ruleFor(form.merchant, merchantRules);
  const branches = branchesFor(activeRule);
  const loan = loanAccountFor(form, accounts);
  const spare = spareAccountFor(form, accounts);
  const roundUp = roundUpFor(form);
  const account = accounts.find(item => item.id === (form.type === 'income' ? form.toAccountId : form.fromAccountId));
  const currency = account?.currency ?? 'EUR';
  const canSyncBranch = !!form.merchant.trim() && !NO_BRANCH_MERCHANTS.includes(form.merchant.trim());
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial.current);

  const categories = form.type === 'income' ? incomeCategories : expenseCategories;
  const categoryChoices = useMemo<Category[]>(
    () => (form.type === 'transfer' ? [{ id: 'transfer', name: 'Transfer', subCategories: [] } as unknown as Category, ...categories] : categories),
    [form.type, categories]
  );
  const suggestions = useMemo(() => (form.type === 'transfer' ? [] : suggestCategories(
    { merchant: form.merchant, description: form.description, type: form.type } as Transaction, transactions, activeRule?.category
  )), [form.type, form.merchant, form.description, transactions, activeRule?.category]);

  const ACCOUNT_TYPE_ORDER = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending', 'Credit Card', 'Loan', 'Other Liabilities'];
  const rank = (type: string) => {
    const i = ACCOUNT_TYPE_ORDER.indexOf(type);
    return i === -1 ? ACCOUNT_TYPE_ORDER.length : i;
  };

  const accountOptions = (exclude?: string, selected?: string): PickerOption[] => {
    const filtered = accounts.filter(item => item.id !== exclude && (item.status !== 'closed' || item.id === selected));
    const open = filtered.filter(a => a.status !== 'closed').sort((a, b) => rank(a.type) - rank(b.type));
    const closed = filtered.filter(a => a.status === 'closed');
    const sorted = [...open, ...closed];

    return sorted.map(item => {
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
  };

  const setType = (type: string) => update({ type: type as TxType, ...accountsForType(form, type as TxType), ...(isEditing ? {} : { category: initialCategory || (type === 'transfer' ? 'Transfer' : ''), categoryEdited: !!initialCategory }) });

  const setBranch = (branch: MerchantLocation) => {
    update({ ...locationFromBranch(branch), locationEdited: true });
    toast.success(`Location set to ${branch.label || branch.address}`);
  };

  const handleAddress = (value: string, data?: AddressData) => {
    if (data) {
      update({ address: value, locationEdited: true, placeName: data.placeName || '', street: data.street || '', city: data.city || '', postalCode: data.postalCode || '', stateRegion: data.state || '', country: data.country || '', latitude: data.lat, longitude: data.lon, locationLabel: data.placeName || '' });
    } else if (!value) {
      update({ ...clearedLocation(), locationEdited: true });
    } else {
      const parsed = parseLocationString(value);
      update({ address: value, locationEdited: true, city: parsed.city, country: parsed.country || '' });
    }
  };

  const handleSave = () => {
    const plan = planTransactionSave(form, transactionToEdit, { accounts, transactions });
    if ('error' in plan) {
      const message = plan.error;
      setErrors({
        amount: /amount|principal/i.test(message) ? message : undefined,
        description: /description/i.test(message) ? message : undefined,
        account: /account/i.test(message) ? message : undefined,
        category: /category/i.test(message) && !form.category ? 'Pick a category' : undefined,
      });
      toast.error(message);
      return;
    }
    if (plan.branch) {
      const { key, location } = plan.branch;
      setPreferences(prev => ({ ...prev, merchantRules: { ...(prev.merchantRules || {}), [key]: mergeBranch(prev.merchantRules?.[key] || {}, location) } }));
    }
    onSave(plan.toSave, plan.toDelete);
    onClose();
  };

  const clearFields = () => {
    update({ merchant: '', description: '', amount: '', category: '', notes: '', tagIds: [], ...clearedLocation() });
    toast.info('Fields cleared');
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
      pickMerchant(merchantMatches[activeIndex].name);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setMerchantOpen(false);
    }
  };

  const locMeta = useMemo(
    () =>
      formatTransactionLocation({
        city: form.city,
        country: form.country,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
      }),
    [form.city, form.country, form.address, form.latitude, form.longitude]
  );
  const locationSummary = useMemo(() => {
    const text = form.locationLabel || form.placeName || locMeta.city || form.address;
    if (!text && !locMeta.hasLocation) return null;
    return (
      <span className="flex items-center gap-1.5 truncate">
        {locMeta.flag ? (
          <span className="text-[13px] leading-none shrink-0" aria-hidden>{locMeta.flag}</span>
        ) : (
          <Icon name="location_on" size={14} className="shrink-0 text-money-in" />
        )}
        <span className="truncate">{text}</span>
      </span>
    );
  }, [form.locationLabel, form.placeName, form.address, locMeta]);

  const allAvailableTags = tagsContext?.tags?.length ? tagsContext.tags : tags;
  const selectedTags = useMemo(() => {
    return form.tagIds
      .map(id => allAvailableTags.find(t => t.id === id))
      .filter((t): t is Tag => !!t);
  }, [form.tagIds, allAvailableTags]);

  // Properties and vehicles a payment can be for (rent, repairs, fuel). Closed ones only when already chosen.
  const assetOptions = useMemo<PickerOption[]>(() => {
    const assets = accounts.filter(item => (item.type === 'Property' || item.type === 'Vehicle') && (item.status !== 'closed' || item.id === form.assetId));
    return assets.length ? [{ id: '', label: 'None' }, ...assets.map(item => ({ id: item.id, label: item.name, description: item.type }))] : [];
  }, [accounts, form.assetId]);

  const extrasSummary = useMemo(() => {
    if (selectedTags.length === 0 && !form.notes) return null;
    return (
      <span className="flex items-center gap-1.5 truncate">
        {selectedTags.slice(0, 3).map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-inset border border-line"
            style={{ color: tag.color || 'var(--ink)' }}
          >
            <Icon name={tag.icon || 'tag'} size={12} style={{ color: tag.color }} className="shrink-0" />
            <span className="truncate max-w-[80px]">{tag.name}</span>
          </span>
        ))}
        {selectedTags.length > 3 && <span className="text-xs text-muted">+{selectedTags.length - 3}</span>}
        {form.notes && <span className="text-xs text-muted">{selectedTags.length > 0 ? '· ' : ''}Note</span>}
      </span>
    );
  }, [selectedTags, form.notes]);

  const merchantLogo = useMemo(() => {
    const name = form.merchant.trim();
    if (!name) return null;
    return getMerchantLogoUrl(name, brandfetchClientId, logoOverrides, {
      fallback: 'lettermark',
      type: 'icon',
      width: 64,
      height: 64,
    });
  }, [form.merchant, brandfetchClientId, logoOverrides]);

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={isEditing ? 'Edit transaction' : 'New transaction'}
      isDirty={isDirty}
      footer={close => (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onPress={clearFields}>Clear</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={handleSave}>{isEditing ? 'Save changes' : 'Save transaction'}</Button>
          </div>
        </div>
      )}
    >
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        <SmoothTab
          fullWidth
          className="w-full"
          items={TRANSACTION_TYPE_TABS}
          value={form.type}
          onChange={setType}
          label="Transaction type"
        />

        <div>
          <div className="type-label mb-1.5 flex items-center justify-between text-muted">
            <span>Amount</span>
            {loan && <Badge tone="neutral">Loan payment</Badge>}
          </div>
          <AmountPad
            autoFocus
            currency={currency}
            value={form.amount}
            onChange={amount => update({ amount })}
            onBlur={() => setForm(prev => {
              const value = parseFloat(prev.amount);
              return applyAutofill(!isNaN(value) && value > 0 ? { ...prev, amount: value.toFixed(2) } : prev);
            })}
          />
          {errors.amount && <p role="alert" className="type-caption mt-1.5 text-money-out">{errors.amount}</p>}
        </div>

        <div className="relative">
          <label htmlFor="tx-merchant" className="type-label mb-1.5 block text-ink">Merchant</label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3 z-10 flex size-6 shrink-0 items-center justify-center">
              {form.merchant.trim() ? (
                <LogoTile
                  url={merchantLogo}
                  label={form.merchant}
                  size={24}
                  rounded="md"
                  fallbackIcon={form.type === 'transfer' ? 'arrow-data-transfer-horizontal' : 'store-01'}
                />
              ) : (
                <Icon
                  name={form.type === 'transfer' ? 'arrow-data-transfer-horizontal' : 'store-01'}
                  size={18}
                  className="text-muted"
                />
              )}
            </span>
            <input
              id="tx-merchant"
              role="combobox"
              aria-expanded={isMerchantOpen && merchantMatches.length > 0}
              aria-controls="tx-merchant-list"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `tx-merchant-${activeIndex}` : undefined}
              autoComplete="off"
              value={form.merchant}
              placeholder={form.type === 'transfer' ? 'Internal Transfer' : 'Shop, company or person'}
              onChange={e => {
                const { value } = e.target;
                setMerchantOpen(true);
                setForm(prev => (value.length >= 2 ? applyAutofill({ ...prev, merchant: value }) : { ...prev, merchant: value }));
              }}
              onFocus={() => { setMerchantOpen(true); setActiveIndex(-1); }}
              onBlur={() => setMerchantOpen(false)}
              onKeyDown={onMerchantKey}
              className={cn(controlStyles, 'h-11 pl-11 pr-9 text-[.9375rem] font-medium max-md:h-12 max-md:text-base')}
            />
            {form.merchant.trim() && (
              <button
                type="button"
                aria-label="Clear merchant"
                onMouseDown={e => {
                  e.preventDefault();
                  setForm(prev => ({ ...prev, merchant: '', merchantEdited: true }));
                }}
                className="absolute right-3 flex size-5 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          {isMerchantOpen && merchantMatches.length > 0 && (
            <ul id="tx-merchant-list" role="listbox" aria-label="Merchants" className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-solid p-1.5 shadow-sm">
              {merchantMatches.map((item, index) => {
                const logo = getMerchantLogoUrl(item.name, brandfetchClientId, logoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                return (
                  <li key={item.name} id={`tx-merchant-${index}`} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pickMerchant(item.name)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn('flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-left pointer-coarse:min-h-12', index === activeIndex && 'bg-inset')}
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
          {branches.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Branches of ${form.merchant}`}>
              {branches.map(branch => {
                const isOn = form.address === branch.address || (!!form.locationLabel && form.locationLabel === branch.label);
                return (
                  <button key={branch.id} type="button" aria-pressed={isOn} title={branch.address} onClick={() => setBranch(branch)} className={cn('h-8 cursor-pointer rounded-full border px-3 text-[.8125rem] font-bold text-ink pointer-coarse:h-11', isOn ? 'border-primary bg-primary-soft' : 'border-line-strong hover:bg-inset')}>
                    {branch.label || branch.city || branch.placeName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {form.type === 'transfer' ? (
          <div className="flex items-end gap-1 max-md:flex-col max-md:items-stretch">
            <Combobox className="min-w-0 flex-1 max-md:flex-none" label="From" error={errors.account} options={accountOptions(form.toAccountId, form.fromAccountId)} value={form.fromAccountId} onChange={id => id && update({ fromAccountId: id })} placeholder="Search accounts" />
            <IconButton className="max-md:self-end" icon="arrow-data-transfer-horizontal" label="Swap accounts" onPress={() => update({ fromAccountId: form.toAccountId, toAccountId: form.fromAccountId })} />
            <Combobox className="min-w-0 flex-1 max-md:flex-none" label="To" error={errors.account} options={accountOptions(form.fromAccountId, form.toAccountId)} value={form.toAccountId} onChange={id => id && update({ toAccountId: id })} placeholder="Search accounts" />
          </div>
        ) : (
          <Combobox
            label="Account"
            error={errors.account}
            options={accountOptions(undefined, account?.id)}
            value={account?.id ?? null}
            onChange={id => id && update(form.type === 'income' ? { toAccountId: id } : { fromAccountId: id })}
            placeholder="Search accounts"
          />
        )}

        <DateInput label="Date" value={form.date} onChange={date => update({ date })} dateFormat={userDateFormat} isRequired />

        <CategoryPicker
          categories={categoryChoices}
          suggestions={suggestions}
          value={form.category || null}
          error={errors.category}
          onChange={category => update({ category, categoryEdited: true })}
        />

        <TextInput
          label="Description"
          error={errors.description}
          isRequired
          value={form.description}
          placeholder={form.type === 'transfer' ? 'What is this transfer for?' : 'What was this for?'}
          onChange={description => update({ description, descriptionEdited: true })}
          onBlur={() => setForm(prev => {
            return applyAutofill(!prev.merchant && prev.description ? { ...prev, merchant: prev.description } : prev);
          })}
        />

        {loan && (
          <section className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-4">
            <Switch isSelected={form.autoLoanSplit} onChange={autoLoanSplit => update({ autoLoanSplit })}>Split principal and interest automatically</Switch>
            <div className="grid grid-cols-2 gap-3">
              <AmountInput label="Principal" currency={currency} value={form.principal} onChange={value => setForm(prev => editLoanPart(prev, 'principal', value))} />
              <AmountInput label="Interest" currency={currency} value={form.interest} onChange={value => setForm(prev => editLoanPart(prev, 'interest', value))} />
            </div>
          </section>
        )}

        <div>
          <Expander title="Location" summary={locationSummary}>
            {activeRule?.isOnline && <p className="type-body text-muted">{form.merchant} is an online business, so a location is optional.</p>}
            {branches.length > 0 && (
              <ul className="divide-y divide-line">
                {branches.map(branch => (
                  <li key={branch.id}>
                    <button type="button" onClick={() => setBranch(branch)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left">
                      <span className="min-w-0">
                        <span className="type-body-strong block truncate text-ink">{branch.label || branch.placeName || 'Branch'}{branch.isPrimary ? ', primary' : ''}</span>
                        <span className="type-caption block truncate text-muted">{branch.address}</span>
                      </span>
                      {form.address === branch.address && <Icon name="check" size={20} className="shrink-0 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AddressAutocomplete value={form.address} onChange={handleAddress} placeholder="Search an address, shop or city" />
            {form.address && (
              <div className="flex flex-wrap items-center gap-2">
                {form.latitude !== undefined && form.longitude !== undefined && <a href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer" className="type-label text-primary underline underline-offset-2">Open in Google Maps</a>}
                <Button variant="ghost" size="sm" onPress={() => setShowManualLocation(open => !open)}>{showManualLocation ? 'Hide details' : 'Fine-tune'}</Button>
                <Button variant="ghost" size="sm" onPress={() => update({ ...clearedLocation(), locationEdited: true })}>Remove</Button>
              </div>
            )}
            {showManualLocation && (
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Branch name" value={form.locationLabel} onChange={locationLabel => update({ locationLabel, locationEdited: true })} />
                <TextInput label="City" value={form.city} onChange={city => update({ city, locationEdited: true })} />
                <TextInput label="Latitude" inputMode="decimal" value={form.latitude === undefined ? '' : String(form.latitude)} onChange={value => update({ latitude: value ? parseFloat(value) : undefined, locationEdited: true })} />
                <TextInput label="Longitude" inputMode="decimal" value={form.longitude === undefined ? '' : String(form.longitude)} onChange={value => update({ longitude: value ? parseFloat(value) : undefined, locationEdited: true })} />
              </div>
            )}
            {canSyncBranch && <Switch isSelected={form.syncLocationToMerchant} onChange={syncLocationToMerchant => update({ syncLocationToMerchant })}>Save this location to {form.merchant}</Switch>}
          </Expander>

          {form.type === 'expense' && (
            <Switch isSelected={form.excludeFromBudget} onChange={excludeFromBudget => update({ excludeFromBudget })}>Leave out of budgets</Switch>
          )}

          <Expander title="Tags and notes" summary={extrasSummary}>
            <TagPicker tags={tagsContext?.tags?.length ? tagsContext.tags : tags} selected={form.tagIds} onChange={tagIds => update({ tagIds })} saveTag={tagsContext?.saveTag} />
            {assetOptions.length > 0 && (
              <Select label="For a property or vehicle" help="Shows on its page: rent, repairs, fuel, insurance." options={assetOptions} value={form.assetId} onChange={assetId => update({ assetId })} />
            )}
            <Textarea label="Notes" value={form.notes} onChange={notes => update({ notes })} />
          </Expander>

          {spare && (
            <Expander
              title="Round-up"
              summary={
                form.roundUpOn
                  ? (roundUp > 0 ? `${formatCurrency(roundUp, currency)} to ${spare.name}` : `To ${spare.name}`)
                  : 'Off'
              }
            >
              <Switch isSelected={form.roundUpOn} onChange={roundUpOn => update({ roundUpOn })}>Round up to {spare.name}</Switch>
              {form.roundUpOn && (
                <div className="grid grid-cols-2 gap-3">
                  <RadioGroup label="Whole amounts" value={form.roundUpBehavior} onChange={value => update({ roundUpBehavior: value as TxForm['roundUpBehavior'] })}>
                    <Radio value="skip">Skip</Radio>
                    <Radio value="unit">Add one</Radio>
                  </RadioGroup>
                  <TextInput label="Multiplier" inputMode="numeric" value={form.roundUpMultiplier} onChange={roundUpMultiplier => update({ roundUpMultiplier })} />
                </div>
              )}
            </Expander>
          )}
        </div>
      </form>
    </SidePanel>
  );
};

export default AddTransactionModal;
