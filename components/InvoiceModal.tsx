
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Invoice, InvoiceItem, InvoiceType, InvoiceDirection, InvoiceStatus, Currency } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency, toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import Icon from './ui/Icon';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
  invoice?: Invoice | null;
  initialType?: InvoiceType;
}

const STATUS_OPTIONS: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'accepted', 'rejected'];

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: string; color: string }> = {
  draft: { label: 'Draft', icon: 'edit', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
  sent: { label: 'Sent', icon: 'send', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  paid: { label: 'Paid', icon: 'check_circle', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  overdue: { label: 'Overdue', icon: 'warning', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  accepted: { label: 'Accepted', icon: 'verified', color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
  rejected: { label: 'Rejected', icon: 'cancel', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
};

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  invoice,
  initialType = 'invoice',
}) => {
  const isEditing = !!invoice;
  const preferences = usePreferencesSelector((p) => p);
  const brandfetchClientId = preferences.brandfetchClientId || '';
  const merchantLogoOverrides = preferences.merchantLogoOverrides || {};

  // Core State
  const [type, setType] = useState<InvoiceType>(initialType);
  const [direction, setDirection] = useState<InvoiceDirection>('sent');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');

  // Entity State
  const [entityName, setEntityName] = useState('');
  const [entityEmail, setEntityEmail] = useState('');
  const [entityAddress, setEntityAddress] = useState('');
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Totals State
  const [taxRate, setTaxRate] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [notes, setNotes] = useState('');

  // Drawer Animation State
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (invoice) {
        setType(invoice.type);
        setDirection(invoice.direction);
        setStatus(invoice.status);
        setNumber(invoice.number);
        setDate(invoice.date);
        setDueDate(invoice.dueDate || '');
        setCurrency(invoice.currency);
        setEntityName(invoice.entityName);
        setEntityEmail(invoice.entityEmail || '');
        setEntityAddress(invoice.entityAddress || '');
        setItems(invoice.items.map((i) => ({ ...i })));
        setTaxRate(invoice.taxRate ? String(invoice.taxRate) : '');
        setGlobalDiscount(invoice.globalDiscountValue ? String(invoice.globalDiscountValue) : '');
        setNotes(invoice.notes || '');
      } else {
        setType(initialType);
        setDirection('sent');
        setStatus('draft');
        setNumber(`${initialType === 'quote' ? 'QT' : 'INV'}-${Date.now().toString().slice(-6)}`);
        setDate(toLocalISOString(new Date()));
        setDueDate('');
        setCurrency(((preferences.currency || 'EUR').split(' ')[0] as Currency) || 'EUR');
        setEntityName('');
        setEntityEmail('');
        setEntityAddress('');
        setItems([{ id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 }]);
        setTaxRate('');
        setGlobalDiscount('');
        setNotes('');
      }
      setLogoLoadError(false);

      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, invoice, initialType, preferences.currency]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  // Recalculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100)),
      0
    );
    const disc = parseFloat(globalDiscount) || 0;
    const taxPercent = parseFloat(taxRate) || 0;
    const taxableAmount = Math.max(0, subtotal - disc);
    const taxAmount = taxableAmount * (taxPercent / 100);
    const total = taxableAmount + taxAmount;
    return { subtotal, taxAmount, total };
  }, [items, globalDiscount, taxRate]);

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          updated.total = updated.quantity * updated.unitPrice * (1 - (updated.discountPercent || 0) / 100);
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{ id: uuidv4(), description: '', quantity: 1, unitPrice: 0, total: 0, discountPercent: 0 }]);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleTypeChange = (newType: InvoiceType) => {
    setType(newType);
    if (!isEditing) {
      setNumber(`${newType === 'quote' ? 'QT' : 'INV'}-${Date.now().toString().slice(-6)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim()) {
      alert('Please specify the recipient / client entity name.');
      return;
    }

    onSave({
      id: invoice?.id,
      type,
      direction,
      status,
      number,
      date,
      dueDate: dueDate || undefined,
      currency,
      entityName: entityName.trim(),
      entityEmail: entityEmail.trim() || undefined,
      entityAddress: entityAddress.trim() || undefined,
      items: items.filter((i) => i.description.trim() || i.unitPrice > 0),
      subtotal: totals.subtotal,
      taxRate: parseFloat(taxRate) || 0,
      taxAmount: totals.taxAmount,
      globalDiscountValue: parseFloat(globalDiscount) || 0,
      total: totals.total,
      notes: notes.trim() || undefined,
    });
    handleClose();
  };

  const clientLogo = getMerchantLogoUrl(entityName, brandfetchClientId, merchantLogoOverrides, {
    fallback: 'lettermark',
    type: 'icon',
    width: 64,
    height: 64,
  });
  const showLogo = clientLogo && !logoLoadError;

  const labelStyle =
    'block text-2xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5';

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Slide-out Sidebar Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div
          className={`pointer-events-auto w-screen max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-screen bg-white dark:bg-[#12141a] text-light-text dark:text-white shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient Top Glow */}
          <div className="absolute top-0 right-0 left-0 h-40 bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent pointer-events-none" />

          {/* 1. DRAWER HEADER */}
          <div className="relative px-6 py-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#12141a]/80 backdrop-blur-md z-20">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs transition-colors ${
                  type === 'invoice'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}
              >
                <Icon name={type === 'invoice' ? 'receipt_long' : 'request_quote'} className="text-xl" />
              </div>
              <div>
                <h2 className="text-lg font-black text-light-text dark:text-white tracking-tight">
                  {isEditing
                    ? type === 'invoice'
                      ? 'Edit Invoice Record'
                      : 'Edit Price Quote'
                    : type === 'invoice'
                    ? 'New Invoice'
                    : 'New Estimate / Quote'}
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                  {type === 'invoice'
                    ? 'Client billing, receivables, and structured invoices'
                    : 'Price proposals, project estimates, and commercial quotes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-light-text dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Close (Esc)"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>
          </div>

          {/* 2. TOP MODE SWITCHER TABS */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <div className="p-1 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center gap-1 border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => handleTypeChange('invoice')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'invoice'
                    ? 'bg-white dark:bg-dark-card text-blue-600 dark:text-blue-400 shadow-sm border border-black/5 dark:border-white/10'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="receipt_long" className="text-sm" />
                <span>Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('quote')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'quote'
                    ? 'bg-white dark:bg-dark-card text-amber-600 dark:text-amber-400 shadow-sm border border-black/5 dark:border-white/10'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="request_quote" className="text-sm" />
                <span>Quote / Estimate</span>
              </button>
            </div>
          </div>

          {/* 3. SCROLLABLE FORM BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
            <form id="invoice-quote-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Document Overview & Lifecycle */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelStyle}>Document Index</label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-11 font-mono font-bold text-sm`}
                      placeholder={type === 'quote' ? 'QT-001' : 'INV-001'}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Settlement Currency</label>
                    <div className={SELECT_WRAPPER_STYLE}>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className={`${SELECT_STYLE} h-11 font-bold`}
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF (CHF)</option>
                        <option value="CAD">CAD ($)</option>
                      </select>
                      <div className={SELECT_ARROW_STYLE}>
                        <Icon name="expand_more" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelStyle}>Direction</label>
                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 h-11">
                      <button
                        type="button"
                        onClick={() => setDirection('sent')}
                        className={`flex-1 text-xs font-bold rounded-lg transition-all ${
                          direction === 'sent'
                            ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        Receivable (Sent)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirection('received')}
                        className={`flex-1 text-xs font-bold rounded-lg transition-all ${
                          direction === 'received'
                            ? 'bg-white dark:bg-dark-card text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        Payable (Recv)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Pills */}
                <div>
                  <label className={labelStyle}>Lifecycle Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((st) => {
                      const cfg = STATUS_CONFIG[st];
                      const isSelected = status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatus(st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? `${cfg.color} shadow-sm scale-105`
                              : 'border-black/5 dark:border-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                        >
                          <Icon name={cfg.icon} className="text-xs" />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date emission & due date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/5 dark:border-white/5">
                  <div>
                    <label className={labelStyle}>Emission Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-11 font-medium`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Maturity / Expiry Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-11 font-medium`}
                    />
                  </div>
                </div>
              </div>

              {/* Entity / Recipient Profile */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-light-text dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Icon name="corporate_fare" className="text-blue-500" />
                    <span>Client / Counterparty Entity</span>
                  </h4>
                  {showLogo && (
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 p-1 border border-black/5 dark:border-white/10 shadow-xs overflow-hidden flex items-center justify-center">
                      <img
                        src={clientLogo!}
                        alt={entityName}
                        className="w-full h-full object-contain"
                        onError={() => setLogoLoadError(true)}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>Company / Client Name</label>
                    <input
                      type="text"
                      value={entityName}
                      onChange={(e) => {
                        setEntityName(e.target.value);
                        setLogoLoadError(false);
                      }}
                      className={`${INPUT_BASE_STYLE} h-11 font-bold`}
                      placeholder="e.g. Acme Corp or Jane Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>Billing Email</label>
                    <input
                      type="email"
                      value={entityEmail}
                      onChange={(e) => setEntityEmail(e.target.value)}
                      className={`${INPUT_BASE_STYLE} h-11`}
                      placeholder="billing@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelStyle}>Physical / Tax Address</label>
                  <input
                    type="text"
                    value={entityAddress}
                    onChange={(e) => setEntityAddress(e.target.value)}
                    className={`${INPUT_BASE_STYLE} h-11`}
                    placeholder="123 Business Way, Suite 400, City, Country"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-light-text dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Icon name="list_alt" className="text-emerald-500" />
                    <span>Line Items & Allocation</span>
                  </h4>
                  <span className="text-xs font-bold text-gray-400 font-mono">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2.5 shadow-2xs group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 text-2xs font-mono font-bold flex items-center justify-center text-gray-500 shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          className={`${INPUT_BASE_STYLE} h-9 !text-xs font-bold flex-1`}
                          placeholder="Item or service description..."
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-8 h-8 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Remove Line Item"
                        >
                          <Icon name="delete" className="text-base" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                        <div>
                          <label className="text-3xs font-semibold uppercase text-gray-400 block mb-1">Qty</label>
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className={`${INPUT_BASE_STYLE} h-8 text-xs font-mono font-bold text-right`}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-semibold uppercase text-gray-400 block mb-1">Unit Rate</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={`${INPUT_BASE_STYLE} h-8 text-xs font-mono font-bold text-right`}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-semibold uppercase text-gray-400 block mb-1">Disc %</label>
                          <input
                            type="number"
                            step="1"
                            max="100"
                            min="0"
                            value={item.discountPercent || ''}
                            onChange={(e) =>
                              handleItemChange(item.id, 'discountPercent', parseFloat(e.target.value) || 0)
                            }
                            className={`${INPUT_BASE_STYLE} h-8 text-xs font-mono font-bold text-right`}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-1 flex flex-col justify-end text-right">
                          <span className="text-3xs font-semibold uppercase text-gray-400 block mb-1">Total</span>
                          <span className="text-xs font-black font-mono text-primary-600 dark:text-primary-400 py-1">
                            {formatCurrency(item.total, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-3 rounded-xl border border-dashed border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-500/5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Icon name="add" className="text-base" />
                    <span>Add Line Item</span>
                  </button>
                </div>
              </div>

              {/* Financial Recapitulation & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Notes & Terms */}
                <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                  <label className={labelStyle}>Notes & Payment Terms</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    className={`${INPUT_BASE_STYLE} !text-xs leading-relaxed p-3 resize-none`}
                    placeholder="Payment instructions, bank wire info, IBAN, or special contract terms..."
                  />
                </div>

                {/* Calculation Summary Card */}
                <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3.5">
                  <h4 className="text-xs font-bold text-light-text dark:text-white uppercase tracking-wider">
                    Ledger Summary
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                      <span>Subtotal</span>
                      <span className="font-mono font-bold text-light-text dark:text-white">
                        {formatCurrency(totals.subtotal, currency)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                      <span>Global Discount</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={globalDiscount}
                          onChange={(e) => setGlobalDiscount(e.target.value)}
                          className="w-20 text-right bg-black/5 dark:bg-white/10 rounded-lg px-2 py-0.5 text-xs font-mono font-bold outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                      <span>Tax / VAT Rate %</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          className="w-20 text-right bg-black/5 dark:bg-white/10 rounded-lg px-2 py-0.5 text-xs font-mono font-bold outline-none"
                          placeholder="0%"
                        />
                        <span className="text-2xs font-bold">%</span>
                      </div>
                    </div>

                    {totals.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                        <span>Tax Amount</span>
                        <span className="font-mono font-bold">
                          {formatCurrency(totals.taxAmount, currency)}
                        </span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-black/10 dark:border-white/10 flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase text-primary-600 dark:text-primary-400">
                        Grand Total
                      </span>
                      <span className="text-xl font-black font-mono text-light-text dark:text-white">
                        {formatCurrency(totals.total, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* 4. DRAWER FOOTER */}
          <div className="px-6 py-4 border-t border-black/5 dark:border-white/10 bg-gray-50/80 dark:bg-[#12141a]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className={`${BTN_SECONDARY_STYLE} !py-2.5 !px-5 text-xs font-bold tracking-wider uppercase`}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="invoice-quote-form"
              className={`${BTN_PRIMARY_STYLE} !py-2.5 !px-8 text-xs font-black tracking-wider uppercase shadow-md shadow-primary-500/20`}
            >
              {isEditing
                ? type === 'invoice'
                  ? 'Update Invoice'
                  : 'Update Quote'
                : type === 'invoice'
                ? 'Issue Invoice'
                : 'Create Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default InvoiceModal;
