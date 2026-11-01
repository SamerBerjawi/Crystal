import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Account, Currency, HoldingSummary, InvestmentSubType, InvestmentTransaction, PaymentTerm, Transaction, Warrant } from '../types';
import { CURRENCY_OPTIONS } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import { usePreferencesContext } from '../contexts/DomainProviders';
import { useDebounce } from '../hooks/useDebounce';
import { fetchSymbolMetadata } from '../src/services/twelveDataService';
import { Button, IconButton } from './ui/Actions';
import { AmountInput, DateInput, Switch, TextInput } from './ui/Fields';
import { ConfirmDialog, SidePanel } from './ui/Overlays';
import { Select, type PickerOption } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

export interface InvestmentModalProps {
  onClose: () => void;
  onSaveTrade?: (invTx: Omit<InvestmentTransaction, 'id'> & { id?: string }, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  onSaveGrant?: (warrant: Omit<Warrant, 'id'> & { id?: string }) => void;
  /** Older name for either save. */
  onSave?: (data: any, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>) => void;
  accounts?: Account[];
  cashAccounts?: Account[];
  transactionToEdit?: InvestmentTransaction | null;
  warrantToEdit?: Warrant | null;
  holdings?: HoldingSummary[];
  initialMode?: 'trade' | 'grant';
  /** Opens a trade already on this holding. */
  initialSymbol?: string;
}

const MODES = [{ id: 'trade', label: 'Trade' }, { id: 'grant', label: 'Equity grant' }];
const SIDES = [{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }];
const TAX_TYPES = [{ id: 'percentage', label: 'Percentage' }, { id: 'amount', label: 'Fixed amount' }];
const SUB_TYPES: InvestmentSubType[] = ['Stock', 'ETF', 'Crypto', 'Pension Fund', 'Spare Change', 'Other'];
const CURRENCIES: PickerOption[] = CURRENCY_OPTIONS.map(option => ({ id: option.split(' ')[0], label: option }));

const subTypeFrom = (type: string): InvestmentSubType => {
  const text = type.toLowerCase();
  if (text.includes('etf')) return 'ETF';
  if (text.includes('crypto')) return 'Crypto';
  return 'Stock';
};

/** The trade and grant form (INV-09, INV-10). Trades and prices carry a currency, and a holding its exchange (D-026). */
const InvestmentModal: React.FC<InvestmentModalProps> = ({ onClose, onSaveTrade, onSaveGrant, onSave, accounts = [], cashAccounts = [], transactionToEdit, warrantToEdit, holdings = [], initialMode, initialSymbol }) => {
  const { preferences, setPreferences } = usePreferencesContext();
  const twelveDataApiKey = preferences.twelveDataApiKey || '';
  const configs = preferences.investmentPriceConfigs || {};
  const isEditingTrade = !!transactionToEdit;
  const isEditingGrant = !!warrantToEdit;
  const today = toLocalISOString(new Date());
  const startSymbol = transactionToEdit?.symbol ?? initialSymbol ?? '';

  const initial = useRef({
    mode: (warrantToEdit ? 'grant' : transactionToEdit ? 'trade' : initialMode ?? 'trade') as 'trade' | 'grant',
    side: transactionToEdit?.type ?? ('buy' as 'buy' | 'sell'),
    symbol: startSymbol,
    name: transactionToEdit?.name ?? holdings.find(holding => holding.symbol === startSymbol)?.name ?? '',
    quantity: transactionToEdit ? String(transactionToEdit.quantity) : '',
    price: transactionToEdit ? String(transactionToEdit.price) : '',
    date: transactionToEdit?.date ?? today,
    currency: (transactionToEdit?.currency ?? configs[startSymbol]?.currency ?? 'EUR') as Currency,
    exchange: configs[startSymbol]?.exchange ?? '',
    createCash: !isEditingTrade,
    cashAccountId: cashAccounts[0]?.id ?? '',
    subType: 'Stock' as InvestmentSubType,
    isin: warrantToEdit?.isin ?? '',
    grantName: warrantToEdit?.name ?? '',
    grantDate: warrantToEdit?.grantDate ?? today,
    grantQuantity: warrantToEdit ? String(warrantToEdit.quantity) : '',
    grantPrice: warrantToEdit ? String(warrantToEdit.grantPrice) : '10.00',
    taxType: warrantToEdit?.taxType ?? ('percentage' as 'amount' | 'percentage'),
    taxValue: String(warrantToEdit?.taxValue ?? 0),
  });
  const [draft, setDraft] = useState(initial.current);
  const [taxPayments, setTaxPayments] = useState<PaymentTerm[]>(warrantToEdit?.taxPayments || []);
  const [isCheckingSale, setCheckingSale] = useState(false);
  const update = (patch: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...patch }));

  const upperSymbol = draft.symbol.toUpperCase().trim();
  const debouncedSymbol = useDebounce(draft.symbol, 600);
  const investmentAccounts = useMemo(() => accounts.filter(account => account.type === 'Investment' && account.symbol), [accounts]);
  const existingAccount = investmentAccounts.find(account => account.symbol?.toUpperCase() === upperSymbol);
  const holding = holdings.find(item => item.symbol?.toUpperCase() === upperSymbol);
  const held = holding?.quantity ?? 0;
  const isNewSymbol = !isEditingTrade && !!upperSymbol && !holding && !existingAccount;

  const suggestions = useMemo(() => {
    const text = draft.symbol.toLowerCase();
    if (!text || existingAccount) return [];
    return investmentAccounts.filter(account => account.symbol?.toLowerCase().includes(text) || account.name.toLowerCase().includes(text)).slice(0, 5);
  }, [draft.symbol, investmentAccounts, existingAccount]);

  const fillFromTicker = useCallback(async (symbol: string) => {
    if (!symbol || !twelveDataApiKey) return;
    const metadata = await fetchSymbolMetadata(symbol, twelveDataApiKey);
    if (!metadata) return;
    const isKnown = CURRENCIES.some(option => option.id === metadata.currency);
    setDraft(prev => ({
      ...prev,
      name: prev.name || metadata.name,
      subType: subTypeFrom(metadata.type),
      exchange: prev.exchange || metadata.exchange || '',
      ...(isKnown ? { currency: metadata.currency as Currency } : {}),
    }));
  }, [twelveDataApiKey]);

  useEffect(() => {
    if (debouncedSymbol && isNewSymbol) void fillFromTicker(debouncedSymbol);
  }, [debouncedSymbol, isNewSymbol, fillFromTicker]);

  useEffect(() => {
    if (isEditingTrade || !existingAccount) return;
    const saved = configs[existingAccount.symbol!];
    update({ name: existingAccount.name, subType: (existingAccount.subType as InvestmentSubType) || 'Stock', currency: saved?.currency ?? 'EUR', exchange: saved?.exchange ?? '' });
  }, [existingAccount?.id]);

  const total = (parseFloat(draft.quantity) || 0) * (parseFloat(draft.price) || 0);
  const grantTotal = (parseFloat(draft.grantQuantity) || 0) * (parseFloat(draft.grantPrice) || 0);
  const taxAmount = draft.taxType === 'percentage' ? (grantTotal * (parseFloat(draft.taxValue) || 0)) / 100 : parseFloat(draft.taxValue) || 0;
  const taxLeft = taxAmount - taxPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const save = (data: unknown, cashTx?: Omit<Transaction, 'id'>, newAccount?: Omit<Account, 'id'>, isGrant = false) => {
    if (isGrant && onSaveGrant) onSaveGrant(data as Omit<Warrant, 'id'>);
    else if (!isGrant && onSaveTrade) onSaveTrade(data as Omit<InvestmentTransaction, 'id'>, cashTx, newAccount);
    else if (onSave) onSave(data, cashTx, newAccount);
    else {
      toast.error("You can't save this from here");
      return;
    }
    onClose();
  };

  const saveTrade = () => {
    const quantity = parseFloat(draft.quantity);
    const price = parseFloat(draft.price);
    const name = draft.name.trim() || upperSymbol;
    const saved = configs[upperSymbol];
    // Only a new holding takes the trade's currency: changing an existing one would misread its whole price log.
    const priceCurrency = isNewSymbol ? draft.currency : saved?.currency;
    if (priceCurrency !== saved?.currency || draft.exchange.trim() !== (saved?.exchange ?? '')) {
      setPreferences(prev => ({ ...prev, investmentPriceConfigs: { ...(prev.investmentPriceConfigs || {}), [upperSymbol]: { ...(prev.investmentPriceConfigs?.[upperSymbol] || {}), currency: priceCurrency, exchange: draft.exchange.trim() || undefined } } }));
    }
    const cashAccount = cashAccounts.find(account => account.id === draft.cashAccountId);
    const value = quantity * price;
    const cashTx: Omit<Transaction, 'id'> | undefined = draft.createCash && !isEditingTrade && cashAccount ? {
      date: draft.date,
      amount: draft.side === 'buy' ? -value : value,
      currency: draft.currency,
      description: `${draft.side === 'buy' ? 'Buy' : 'Sell'} ${quantity} ${upperSymbol}`,
      category: 'Investments',
      accountId: cashAccount.id,
      type: draft.side === 'buy' ? 'expense' : 'income',
    } : undefined;
    const newAccount: Omit<Account, 'id'> | undefined = isNewSymbol ? { name, type: 'Investment', subType: draft.subType, balance: 0, currency: draft.currency, symbol: upperSymbol } : undefined;
    save({ id: transactionToEdit?.id, symbol: upperSymbol, name, quantity, price, date: draft.date, type: draft.side, currency: draft.currency }, cashTx, newAccount);
  };

  const handleSave = () => {
    if (draft.mode === 'trade') {
      if (!upperSymbol) {
        toast.error('Add a ticker');
        return;
      }
      if (!(parseFloat(draft.quantity) > 0) || !(parseFloat(draft.price) > 0)) {
        toast.error('Enter a quantity and a price');
        return;
      }
      if (draft.side === 'sell' && holding && parseFloat(draft.quantity) > held) {
        setCheckingSale(true);
        return;
      }
      saveTrade();
      return;
    }
    const isin = draft.isin.toUpperCase().trim();
    if (!isin) {
      toast.error('Add a ticker or ISIN');
      return;
    }
    if (!(parseFloat(draft.grantQuantity) > 0) || !(parseFloat(draft.grantPrice) > 0)) {
      toast.error('Enter a quantity and a grant price');
      return;
    }
    if (taxPayments.length > 0 && Math.abs(taxLeft) >= 0.01) {
      toast.error(`Tax instalments are ${formatCurrency(Math.abs(taxLeft), 'EUR')} ${taxLeft > 0 ? 'short' : 'over'}`);
      return;
    }
    save({
      id: warrantToEdit?.id, isin, name: draft.grantName.trim() || isin, grantDate: draft.grantDate, quantity: parseFloat(draft.grantQuantity), grantPrice: parseFloat(draft.grantPrice),
      taxType: draft.taxType, taxValue: parseFloat(draft.taxValue) || 0, taxAmount, taxPayments,
    }, undefined, undefined, true);
  };

  const updatePayment = (id: string, changes: Partial<PaymentTerm>) => setTaxPayments(items => items.map(item => (item.id === id ? { ...item, ...changes } : item)));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial.current) || taxPayments !== (warrantToEdit?.taxPayments || taxPayments);

  const title = isEditingTrade ? 'Edit trade' : isEditingGrant ? 'Edit grant' : draft.mode === 'trade' ? 'New trade' : 'New equity grant';

  return (
    <>
      <SidePanel
        isOpen
        onClose={onClose}
        title={title}
        isDirty={isDirty}
        footer={close => (
          <div className="flex items-center justify-between gap-3">
            <span className="type-caption min-w-0 text-muted">
              {draft.mode === 'trade' ? (total > 0 ? `Total ${formatCurrency(total, draft.currency)}` : '') : grantTotal > 0 ? `Total ${formatCurrency(grantTotal, 'EUR')}` : ''}
            </span>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onPress={close}>Cancel</Button>
              <Button onPress={handleSave}>{isEditingTrade || isEditingGrant ? 'Save changes' : 'Save'}</Button>
            </div>
          </div>
        )}
      >
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          {!isEditingTrade && !isEditingGrant && <SegmentedControl className="w-full" items={MODES} activeId={draft.mode} onChange={mode => update({ mode: mode as 'trade' | 'grant' })} />}

          {draft.mode === 'trade' ? (
            <>
              <SegmentedControl className="w-full" items={SIDES} activeId={draft.side} onChange={side => update({ side: side as 'buy' | 'sell' })} />
              <div>
                <TextInput label="Ticker" value={draft.symbol} onChange={symbol => update({ symbol })} isDisabled={isEditingTrade} autoFocus={!startSymbol} />
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map(account => <Button key={account.id} variant="secondary" size="sm" onPress={() => update({ symbol: account.symbol ?? '' })}>{account.symbol}</Button>)}
                  </div>
                )}
              </div>
              <TextInput label="Name" value={draft.name} onChange={name => update({ name })} />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Quantity" inputMode="decimal" value={draft.quantity} onChange={quantity => update({ quantity })} help={holding ? `You hold ${held.toLocaleString()}.` : undefined} />
                <AmountInput label="Price each" value={draft.price} onChange={price => update({ price })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Currency" options={CURRENCIES} value={draft.currency} onChange={id => update({ currency: id as Currency })} />
                <TextInput label="Exchange" value={draft.exchange} onChange={exchange => update({ exchange })} help="Optional, for tickers listed in several places." />
              </div>
              <DateInput label="Date" value={draft.date} onChange={date => update({ date })} />
              {isNewSymbol && <Select label="Kind of asset" options={SUB_TYPES.map(item => ({ id: item, label: item }))} value={draft.subType} onChange={id => update({ subType: id as InvestmentSubType })} />}
              {!isEditingTrade && cashAccounts.length > 0 && (
                <>
                  <Switch isSelected={draft.createCash} onChange={createCash => update({ createCash })}>{draft.side === 'buy' ? 'Take the money from an account' : 'Pay the money into an account'}</Switch>
                  {draft.createCash && <Select label="Account" options={cashAccounts.map(account => ({ id: account.id, label: account.name, description: formatCurrency(account.balance, account.currency) }))} value={draft.cashAccountId} onChange={cashAccountId => update({ cashAccountId })} />}
                </>
              )}
            </>
          ) : (
            <>
              <TextInput label="Ticker or ISIN" value={draft.isin} onChange={isin => update({ isin })} autoFocus />
              <TextInput label="Name" value={draft.grantName} onChange={grantName => update({ grantName })} />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Quantity" inputMode="decimal" value={draft.grantQuantity} onChange={grantQuantity => update({ grantQuantity })} />
                <AmountInput label="Grant price" currency="EUR" value={draft.grantPrice} onChange={grantPrice => update({ grantPrice })} />
              </div>
              <DateInput label="Grant date" value={draft.grantDate} onChange={grantDate => update({ grantDate })} />
              <div>
                <p className="type-label mb-1.5 text-ink">Tax</p>
                <SegmentedControl className="w-full" items={TAX_TYPES} activeId={draft.taxType} onChange={taxType => update({ taxType: taxType as 'amount' | 'percentage' })} />
              </div>
              <TextInput label={draft.taxType === 'percentage' ? 'Tax rate (%)' : 'Tax amount'} inputMode="decimal" value={draft.taxValue} onChange={taxValue => update({ taxValue })} help={`Tax comes to ${formatCurrency(taxAmount, 'EUR')}.`} />
              <section aria-label="Tax instalments" className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="type-label text-ink">Instalments</h3>
                  <Button variant="secondary" size="sm" icon="add" onPress={() => setTaxPayments(items => [...items, { id: uuidv4(), label: `Tax payment ${items.length + 1}`, percentage: 0, amount: taxLeft > 0 ? taxLeft : 0, dueDate: today, status: 'pending' }])}>Add</Button>
                </div>
                {taxPayments.map(payment => (
                  <div key={payment.id} className="space-y-2 border-t border-line pt-3">
                    <div className="flex items-end gap-1">
                      <TextInput className="min-w-0 flex-1" label="Name" value={payment.label} onChange={label => updatePayment(payment.id, { label })} />
                      <IconButton icon="delete" label={`Remove ${payment.label}`} onPress={() => setTaxPayments(items => items.filter(item => item.id !== payment.id))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <AmountInput label="Amount" currency="EUR" value={String(payment.amount)} onChange={value => updatePayment(payment.id, { amount: parseFloat(value) || 0 })} />
                      <DateInput label="Due" value={payment.dueDate} onChange={dueDate => updatePayment(payment.id, { dueDate })} />
                    </div>
                    <Switch isSelected={payment.status === 'paid'} onChange={isPaid => updatePayment(payment.id, { status: isPaid ? 'paid' : 'pending' })}>Paid</Switch>
                  </div>
                ))}
                {taxPayments.length > 0 && <p className="type-caption text-muted">{Math.abs(taxLeft) < 0.01 ? 'Instalments match the tax.' : `${formatCurrency(Math.abs(taxLeft), 'EUR')} ${taxLeft > 0 ? 'still to schedule' : 'too much scheduled'}.`}</p>}
              </section>
            </>
          )}
        </form>
      </SidePanel>
      <ConfirmDialog
        isOpen={isCheckingSale}
        onClose={() => setCheckingSale(false)}
        onConfirm={() => { setCheckingSale(false); saveTrade(); }}
        title="Sell more than you hold?"
        message={`You hold ${held.toLocaleString()}, and this sells ${draft.quantity}.`}
        confirmLabel="Sell anyway"
      />
    </>
  );
};

export default InvestmentModal;
