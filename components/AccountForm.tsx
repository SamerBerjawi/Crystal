import React, { useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Account, AccountType, Warrant } from '../types';
import { ACCOUNT_TYPE_STYLES, ALL_ACCOUNT_TYPES, CARD_NETWORKS, CURRENCIES, FREQUENCIES, FUEL_TYPES, INVESTMENT_SUB_TYPES, OTHER_ASSET_SUB_TYPES, OTHER_LIABILITY_SUB_TYPES, PROPERTY_TYPES, VEHICLE_OWNERSHIP_TYPES } from '../constants';
import { toLocalISOString } from '../utils';
import { buildAccount, defaultIcon, draftFromAccount, emptyDraft, reconcileLoan, type AccountDraft, type SwitchField, type TextField } from '../utils/accountForm';
import IconPicker from './IconPicker';
import Icon from './ui/Icon';
import { Button, IconButton } from './ui/Actions';
import { AmountInput, DateInput, Switch, Textarea, TextInput } from './ui/Fields';
import { FullPanel } from './ui/Overlays';
import { Select, type PickerOption } from './ui/Pickers';

const NONE = 'none';

const TYPE_HINTS: Partial<Record<AccountType, string>> = {
  Checking: 'Everyday money',
  Savings: 'Money set aside',
  Investment: 'Stocks, funds, pensions, round-ups',
  Property: 'Homes and land',
  Vehicle: 'Cars, owned or leased',
  'Other Assets': 'Cash, collectibles and more',
  Lending: 'Money you lent',
  'Credit Card': 'Cards and statements',
  Loan: 'Mortgages and loans',
  'Other Liabilities': 'Anything else you owe',
};

const options = (values: readonly string[]): PickerOption[] => values.map(value => ({ id: value, label: value }));
const frequencyOptions: PickerOption[] = FREQUENCIES.map(item => ({ id: item.value, label: item.label }));

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
    <h3 className="type-card-title mb-3 text-ink">{title}</h3>
    <div className="grid gap-4 md:grid-cols-2">{children}</div>
  </section>
);

interface AccountFormProps {
  /** Leave out to add a new account. */
  account?: Account;
  accounts: Account[];
  warrants?: Warrant[];
  onClose: () => void;
  onSave: (account: Omit<Account, 'id'> & { id?: string }) => void;
  onDelete?: (accountId: string) => void;
  onToggleStatus?: (accountId: string) => void;
}

/** One form for adding and editing (D-023): pick the type, then short sections for that type. */
const AccountForm: React.FC<AccountFormProps> = ({ account, accounts, warrants = [], onClose, onSave, onDelete, onToggleStatus }) => {
  const isEditing = !!account;
  const initial = useRef(account ? draftFromAccount(account) : emptyDraft());
  const [draft, setDraft] = useState<AccountDraft>(initial.current);
  const [isChoosingType, setChoosingType] = useState(!isEditing);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [newLog, setNewLog] = useState({ date: toLocalISOString(new Date()), reading: '' });
  const imageInput = useRef<HTMLInputElement>(null);

  const { type, subType, vehicleOwnership } = draft;
  const isComputed = type === 'Investment' && !!account?.symbol && warrants.some(warrant => warrant.isin === account.symbol);
  const isDirty = !isChoosingType && JSON.stringify(draft) !== JSON.stringify(initial.current);

  const set = (patch: Partial<AccountDraft>) => setDraft(prev => {
    const next = { ...prev, ...patch };
    // The icon follows the type until you pick your own.
    return prev.icon === defaultIcon(prev) ? { ...next, icon: defaultIcon(next) } : next;
  });

  const accountOptions = (list: Account[], empty: string, selected: string): PickerOption[] => [
    { id: NONE, label: empty },
    ...list.filter(item => item.status !== 'closed' || item.id === selected).map(item => ({ id: item.id, label: item.name, description: item.type })),
  ];
  const debitAccounts = useMemo(() => accounts.filter(item => item.type === 'Checking' || item.type === 'Savings'), [accounts]);
  const loanAccounts = useMemo(() => accounts.filter(item => item.type === 'Loan'), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter(item => item.type === 'Property' || item.type === 'Vehicle'), [accounts]);

  const linkedLoan = type === 'Property' && draft.linkedLoanId ? accounts.find(item => item.id === draft.linkedLoanId) : undefined;
  const linkedPrice = linkedLoan ? String((linkedLoan.principalAmount || 0) + (linkedLoan.downPayment || 0)) : null;

  const textField = (field: TextField, label: string, extra: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <TextInput key={field} label={label} value={draft[field]} onChange={value => set({ [field]: value })} autoComplete="off" {...extra} />
  );
  const numberField = (field: TextField, label: string, extra: Partial<React.ComponentProps<typeof TextInput>> = {}) =>
    textField(field, label, { inputMode: 'numeric', ...extra });
  const money = (field: TextField, label: string, extra: Partial<React.ComponentProps<typeof AmountInput>> = {}) => (
    <AmountInput key={field} label={label} currency={draft.currency} value={draft[field]} onChange={value => set({ [field]: value })} {...extra} />
  );
  const date = (field: TextField, label: string) => <DateInput key={field} label={label} value={draft[field]} onChange={value => set({ [field]: value })} />;
  const toggle = (field: SwitchField, label: string) => <Switch key={field} isSelected={draft[field]} onChange={value => set({ [field]: value })}>{label}</Switch>;
  const pick = (field: keyof AccountDraft, label: string, list: PickerOption[]) => (
    <Select key={String(field)} label={label} options={list} value={(draft[field] as string) || NONE} onChange={value => set({ [field]: value === NONE ? '' : value } as Partial<AccountDraft>)} />
  );
  const loanMoney = (field: 'totalAmount' | 'principalAmount' | 'interestAmount', label: string) => (
    <AmountInput key={field} label={label} currency={draft.currency} value={draft[field]} onChange={value => setDraft(prev => reconcileLoan(prev, field, value))} />
  );

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set({ vehicleImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!draft.name.trim()) {
      toast.error('Enter a name for this account');
      return;
    }
    onSave(buildAccount(draft, { base: account, isComputed }));
    onClose();
  };

  const isLoan = type === 'Loan' || type === 'Lending';
  const showBanking = ['Checking', 'Savings', 'Investment', 'Credit Card', 'Lending'].includes(type);
  const hasInstitution = ['Checking', 'Savings', 'Credit Card'].includes(type);

  const typeTiles = (
    <ul className="grid gap-2 md:grid-cols-2">
      {ALL_ACCOUNT_TYPES.map(item => (
        <li key={item}>
          <button
            type="button"
            onClick={() => { set({ type: item, hasCard: item === 'Credit Card' }); setChoosingType(false); }}
            className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-line p-3 text-left hover:border-line-strong"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-inset text-muted"><Icon name={ACCOUNT_TYPE_STYLES[item]?.icon || 'wallet'} size={20} /></span>
            <span className="min-w-0">
              <span className="type-body-strong block text-ink">{item}</span>
              <span className="type-caption block text-muted">{TYPE_HINTS[item]}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const sections = (
    <div className="space-y-6">
      <Section title="Basics">
        <div className="flex items-end gap-3 md:col-span-2">
          <IconButton icon={draft.icon} label="Change icon" variant="glass" className="mb-0.5 bg-inset" onPress={() => setIconPickerOpen(true)} />
          {textField('name', 'Name', { className: 'min-w-0 flex-1', isRequired: true, autoFocus: !isEditing })}
        </div>
        {pick('type', 'Type', options(ALL_ACCOUNT_TYPES))}
        {pick('currency', 'Currency', options(CURRENCIES))}
        {isLoan
          ? loanMoney('principalAmount', 'Principal')
          : money('balance', isComputed ? 'Market value' : type === 'Vehicle' || type === 'Property' ? 'Current value' : isEditing ? 'Balance' : 'Opening balance', {
            isDisabled: isComputed,
            help: isComputed ? 'Set by live prices.' : undefined,
          })}
      </Section>

      {(showBanking || hasInstitution) && (
        <Section title="Bank details">
          {hasInstitution && textField('financialInstitution', 'Bank')}
          {textField('accountNumber', 'Account number or IBAN')}
          {textField('routingNumber', 'Routing number or BIC')}
          {['Checking', 'Savings', 'Investment'].includes(type) && numberField('apy', 'Interest rate (APY %)', { inputMode: 'decimal' })}
          {date('openingDate', 'Opening date')}
        </Section>
      )}

      {type === 'Investment' && (
        <Section title="Investment">
          {pick('subType', 'Kind', options(INVESTMENT_SUB_TYPES))}
          {['Stock', 'ETF', 'Crypto'].includes(subType) && textField('symbol', 'Ticker symbol')}
          {subType === 'Pension Fund' && numberField('expectedRetirementYear', 'Retirement year')}
          {subType === 'Spare Change' && pick('linkedAccountId', 'Round up from', accountOptions(debitAccounts, 'No account', draft.linkedAccountId))}
        </Section>
      )}

      {type === 'Vehicle' && (
        <>
          <Section title="Vehicle">
            <div className="md:col-span-2">
              <input ref={imageInput} type="file" accept="image/*" onChange={handleImage} className="sr-only" aria-label="Vehicle photo" tabIndex={-1} />
              {draft.vehicleImage && <img src={draft.vehicleImage} alt="" className="mb-2 h-32 w-full rounded-[var(--radius-md)] object-cover" />}
              <Button variant="secondary" icon="add_a_photo" onPress={() => imageInput.current?.click()}>{draft.vehicleImage ? 'Change photo' : 'Add a photo'}</Button>
            </div>
            {textField('make', 'Make')}
            {textField('model', 'Model')}
            {numberField('year', 'Year')}
            {textField('registrationCountryCode', 'Country code')}
            {textField('licensePlate', 'Licence plate')}
            {textField('vin', 'VIN')}
            {pick('fuelType', 'Fuel', options(FUEL_TYPES))}
            {numberField('currentMileage', 'Odometer (km)')}
            {pick('vehicleOwnership', 'Ownership', options(VEHICLE_OWNERSHIP_TYPES))}
          </Section>
          {vehicleOwnership === 'Owned' ? (
            <Section title="Purchase">
              {money('purchasePrice', 'Purchase price')}
              {date('purchaseDate', 'Purchase date')}
            </Section>
          ) : (
            <Section title="Lease">
              {textField('leaseProvider', 'Provider')}
              {date('leaseStartDate', 'Start')}
              {date('leaseEndDate', 'End')}
              {money('leasePaymentAmount', 'Monthly payment')}
              {numberField('leasePaymentDay', 'Payment day of the month')}
              {pick('leasePaymentAccountId', 'Paid from', accountOptions(debitAccounts, 'No account', draft.leasePaymentAccountId))}
              {numberField('annualMileageAllowance', 'Yearly allowance (km)')}
            </Section>
          )}
          {isEditing && (
            <Section title="Mileage history">
              <ul className="divide-y divide-line md:col-span-2">
                {draft.mileageLogs.map((log, index) => (
                  <li key={log.id} className="flex min-h-11 items-center justify-between gap-3">
                    <span className="type-body text-ink">{log.date}</span>
                    <span className="flex items-center gap-1">
                      <span className="type-figure-row text-ink">{log.reading.toLocaleString()} km</span>
                      <IconButton icon="delete" label={`Delete the reading from ${log.date}`} onPress={() => set({ mileageLogs: draft.mileageLogs.filter((_, i) => i !== index) })} />
                    </span>
                  </li>
                ))}
              </ul>
              <DateInput label="Date" value={newLog.date} onChange={value => setNewLog(prev => ({ ...prev, date: value }))} />
              <TextInput label="Reading (km)" inputMode="numeric" value={newLog.reading} onChange={value => setNewLog(prev => ({ ...prev, reading: value }))} />
              <div className="md:col-span-2">
                <Button
                  variant="secondary"
                  icon="add"
                  isDisabled={!newLog.date || !newLog.reading}
                  onPress={() => {
                    set({ mileageLogs: [...draft.mileageLogs, { id: `log-${uuidv4()}`, date: newLog.date, reading: parseInt(newLog.reading, 10) }] });
                    setNewLog(prev => ({ ...prev, reading: '' }));
                  }}
                >
                  Add reading
                </Button>
              </div>
            </Section>
          )}
        </>
      )}

      {type === 'Property' && (
        <>
          <Section title="Property">
            {pick('propertyType', 'Kind', options(PROPERTY_TYPES))}
            {textField('address', 'Address')}
            {pick('linkedLoanId', 'Mortgage', accountOptions(loanAccounts, 'No mortgage', draft.linkedLoanId))}
            {linkedPrice !== null
              ? <AmountInput label="Purchase price" currency={draft.currency} value={linkedPrice} isDisabled help="Taken from the linked mortgage." />
              : <>{money('purchasePrice', 'Purchase price')}{money('principalOwned', 'Equity owned')}</>}
            {numberField('propertySize', 'Size (m²)', { inputMode: 'decimal' })}
            {numberField('yearBuilt', 'Year built')}
            {numberField('floors', 'Floors')}
            {numberField('bedrooms', 'Bedrooms')}
            {numberField('bathrooms', 'Bathrooms')}
            {numberField('indoorParkingSpaces', 'Indoor parking spaces')}
            {numberField('outdoorParkingSpaces', 'Outdoor parking spaces')}
            {toggle('hasBasement', 'Basement')}
            {toggle('hasAttic', 'Attic')}
            {toggle('hasGarden', 'Garden')}
            {draft.hasGarden && numberField('gardenSize', 'Garden size (m²)', { inputMode: 'decimal' })}
            {toggle('hasTerrace', 'Terrace')}
            {draft.hasTerrace && numberField('terraceSize', 'Terrace size (m²)', { inputMode: 'decimal' })}
          </Section>
          <Section title="Running costs and income">
            {money('propertyTaxAmount', 'Yearly property tax')}
            {date('propertyTaxDate', 'Property tax due')}
            {textField('insuranceProvider', 'Insurer')}
            {textField('insurancePolicyNumber', 'Policy number')}
            {money('insuranceAmount', 'Insurance cost')}
            {pick('insuranceFrequency', 'Insurance paid', frequencyOptions)}
            {date('insurancePaymentDate', 'Insurance due')}
            {money('hoaFeeAmount', 'Service charge')}
            {pick('hoaFeeFrequency', 'Service charge paid', frequencyOptions)}
            <div className="md:col-span-2">{toggle('isRental', 'Earns rent')}</div>
            {draft.isRental && money('rentalIncomeAmount', 'Rent')}
            {draft.isRental && pick('rentalIncomeFrequency', 'Rent received', frequencyOptions)}
          </Section>
        </>
      )}

      {isLoan && (
        <Section title={type === 'Loan' ? 'Loan' : 'Lending'}>
          {loanMoney('totalAmount', 'Total to repay')}
          {loanMoney('interestAmount', 'Total interest')}
          {numberField('interestRate', 'Interest rate (APR %)', { inputMode: 'decimal' })}
          {numberField('duration', 'Term (months)')}
          {date('loanStartDate', 'Start date')}
          {type === 'Loan' && money('downPayment', 'Down payment')}
          {money('monthlyPayment', 'Monthly payment')}
          {numberField('paymentDayOfMonth', 'Payment day of the month')}
          {pick('linkedAccountId', 'Paid from', accountOptions(debitAccounts, 'No account', draft.linkedAccountId))}
          {type === 'Loan' && pick('linkedAssetId', 'Secured against', accountOptions(assetAccounts, 'Unsecured', draft.linkedAssetId))}
        </Section>
      )}

      {type === 'Credit Card' && (
        <Section title="Statements">
          {numberField('statementStartDate', 'Statement starts on day')}
          {numberField('paymentDate', 'Payment due on day')}
          {pick('settlementAccountId', 'Paid from', accountOptions(debitAccounts, 'No account', draft.settlementAccountId))}
          {money('creditLimit', 'Credit limit')}
        </Section>
      )}

      {type === 'Other Assets' && (
        <Section title="Asset">
          {pick('otherAssetSubType', 'Kind', options(OTHER_ASSET_SUB_TYPES))}
          {textField('counterparty', 'Linked person or company')}
          {textField('location', 'Location')}
          {textField('assetCondition', 'Condition')}
        </Section>
      )}

      {type === 'Other Liabilities' && (
        <Section title="Debt">
          {pick('otherLiabilitySubType', 'Kind', options(OTHER_LIABILITY_SUB_TYPES))}
          {textField('counterparty', 'Owed to')}
          {numberField('interestRate', 'Interest rate (%)', { inputMode: 'decimal' })}
        </Section>
      )}

      <Section title="Card">
        <div className="md:col-span-2">{toggle('hasCard', 'This account has a card')}</div>
        {draft.hasCard && pick('cardNetwork', 'Network', [{ id: NONE, label: 'Not set' }, ...options(CARD_NETWORKS)])}
        {draft.hasCard && textField('last4', 'Last 4 digits', { maxLength: 4, inputMode: 'numeric' })}
        {draft.hasCard && textField('expirationDate', 'Expiry', { placeholder: 'MM/YY' })}
        {draft.hasCard && textField('cardholderName', 'Name on card')}
      </Section>

      <Section title="Options">
        <div className="flex flex-col gap-2 md:col-span-2">
          {toggle('isPrimary', 'Primary account of this type')}
          {toggle('includeInAnalytics', 'Include in net worth and reports')}
        </div>
        <Textarea className="md:col-span-2" label="Notes" value={draft.notes} onChange={value => set({ notes: value })} />
      </Section>
    </div>
  );

  return (
    <>
      <FullPanel
        isOpen
        onClose={onClose}
        title={isChoosingType ? 'What kind of account?' : isEditing ? `Edit ${account.name}` : `New ${type.toLowerCase()} account`}
        isDirty={isDirty}
        footer={!isChoosingType && (close => (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {isEditing && onDelete && <Button variant="ghost" className="text-money-out" onPress={() => { onClose(); onDelete(account.id); }}>Delete</Button>}
              {isEditing && onToggleStatus && <Button variant="ghost" onPress={() => { onToggleStatus(account.id); onClose(); }}>{account.status === 'closed' ? 'Reopen account' : 'Close account'}</Button>}
              {!isEditing && <Button variant="ghost" onPress={() => setChoosingType(true)}>Change type</Button>}
            </div>
            <div className="flex gap-2 max-md:w-full">
              <Button variant="ghost" className="max-md:flex-1" onPress={close}>Cancel</Button>
              <Button className="max-md:flex-1" onPress={handleSubmit}>{isEditing ? 'Save changes' : 'Add account'}</Button>
            </div>
          </div>
        ))}
      >
        {isChoosingType ? typeTiles : sections}
      </FullPanel>
      {isIconPickerOpen && <IconPicker onClose={() => setIconPickerOpen(false)} onSelect={icon => { setDraft(prev => ({ ...prev, icon })); setIconPickerOpen(false); }} selectedIcon={draft.icon} />}
    </>
  );
};

export default AccountForm;
