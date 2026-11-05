import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { Currency, Invoice, InvoiceDirection, InvoiceItem, InvoiceStatus, InvoiceType } from '../types';
import { CURRENCY_OPTIONS } from '../constants';
import { formatCurrency, toLocalISOString } from '../utils';
import { documentNumber, documentTotals, INVOICE_STATUSES, lineTotal, QUOTE_STATUSES, STATUS_LABELS } from '../utils/invoicesModel';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { BrandMark } from './ServiceCard';
import { Button, IconButton } from './ui/Actions';
import { AmountInput, DateInput, Textarea, TextInput } from './ui/Fields';
import { FullPanel } from './ui/Overlays';
import { Select } from './ui/Pickers';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

interface InvoiceModalProps {
  onClose: () => void;
  onSave: (invoice: Omit<Invoice, 'id'> & { id?: string }) => void;
  invoice?: Invoice | null;
  initialType?: InvoiceType;
}

/** A line while it's being typed. Numbers stay text until saving, so "1." doesn't jump. */
type DraftLine = Omit<InvoiceItem, 'quantity' | 'unitPrice' | 'discountPercent' | 'total'> & { quantity: string; unitPrice: string; discountPercent: string };

const TYPES: SwipeTabItem[] = [{ id: 'invoice', title: 'Invoice' }, { id: 'quote', title: 'Quote' }];
const DIRECTIONS: SwipeTabItem[] = [{ id: 'sent', title: 'You bill them' }, { id: 'received', title: 'They bill you' }];
const CURRENCIES = CURRENCY_OPTIONS.map(option => ({ id: option.split(' ')[0], label: option }));

const blankLine = (): DraftLine => ({ id: uuidv4(), description: '', quantity: '1', unitPrice: '', discountPercent: '' });
const toNumbers = (line: DraftLine) => ({ quantity: parseFloat(line.quantity) || 0, unitPrice: parseFloat(line.unitPrice) || 0, discountPercent: parseFloat(line.discountPercent) || 0 });

const Section: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ title, aside, children }) => (
  <section aria-label={title} className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-4">
    <div className="flex min-h-9 items-center justify-between gap-2">
      <h3 className="type-card-title text-ink">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

/** Rapport's sectioned invoice form: a full panel, and a full-height sheet on phones (`DOC-03`). */
const InvoiceModal: React.FC<InvoiceModalProps> = ({ onClose, onSave, invoice, initialType = 'invoice' }) => {
  const defaultCurrency = usePreferencesSelector(p => ((p.currency || 'EUR').split(' ')[0] as Currency) || 'EUR');
  const isEditing = !!invoice;
  const initial = useRef({
    type: invoice?.type ?? initialType,
    direction: invoice?.direction ?? ('sent' as InvoiceDirection),
    status: invoice?.status ?? ('draft' as InvoiceStatus),
    number: invoice?.number ?? documentNumber(initialType, Date.now()),
    date: invoice?.date ?? toLocalISOString(new Date()),
    dueDate: invoice?.dueDate ?? '',
    currency: invoice?.currency ?? defaultCurrency,
    entityName: invoice?.entityName ?? '',
    entityEmail: invoice?.entityEmail ?? '',
    entityAddress: invoice?.entityAddress ?? '',
    taxRate: invoice?.taxRate ? String(invoice.taxRate) : '',
    globalDiscount: invoice?.globalDiscountValue ? String(invoice.globalDiscountValue) : '',
    notes: invoice?.notes ?? '',
    lines: invoice?.items.length
      ? invoice.items.map(({ total: _total, ...item }) => ({ ...item, quantity: String(item.quantity), unitPrice: String(item.unitPrice), discountPercent: item.discountPercent ? String(item.discountPercent) : '' }))
      : [blankLine()],
  });
  const [draft, setDraft] = useState(initial.current);
  const update = (patch: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...patch }));
  const updateLine = (id: string, patch: Partial<DraftLine>) => update({ lines: draft.lines.map(line => (line.id === id ? { ...line, ...patch } : line)) });

  const totals = useMemo(() => documentTotals(draft.lines.map(toNumbers), parseFloat(draft.globalDiscount) || 0, parseFloat(draft.taxRate) || 0), [draft.lines, draft.globalDiscount, draft.taxRate]);
  const statuses = draft.type === 'quote' ? QUOTE_STATUSES : INVOICE_STATUSES;
  const statusOptions = [...statuses, ...(statuses.includes(draft.status) ? [] : [draft.status])].map(id => ({ id, label: STATUS_LABELS[id] }));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial.current);

  const changeType = (type: InvoiceType) => {
    const statusFits = (type === 'quote' ? QUOTE_STATUSES : INVOICE_STATUSES).includes(draft.status);
    update({ type, status: statusFits ? draft.status : 'draft', number: isEditing ? draft.number : documentNumber(type, Date.now()) });
  };

  const removeLine = (id: string) => update({ lines: draft.lines.length > 1 ? draft.lines.filter(line => line.id !== id) : [blankLine()] });

  const save = () => {
    if (!draft.entityName.trim()) {
      toast.error(draft.direction === 'sent' ? 'Add who this is for' : 'Add who this is from');
      return;
    }
    if (!draft.number.trim() || !draft.date) {
      toast.error('Add a number and a date');
      return;
    }
    if (draft.dueDate && draft.dueDate < draft.date) {
      toast.error(draft.type === 'quote' ? 'Valid-until date cannot be before issue date' : 'Due date cannot be before issue date');
      return;
    }
    const items: InvoiceItem[] = draft.lines
      .map(line => {
        const numbers = toNumbers(line);
        return { ...line, ...numbers, total: lineTotal(numbers.quantity, numbers.unitPrice, numbers.discountPercent) };
      })
      .filter(item => item.description.trim() || item.unitPrice > 0);
    onSave({
      id: invoice?.id,
      type: draft.type,
      direction: draft.direction,
      status: draft.status,
      number: draft.number.trim(),
      date: draft.date,
      dueDate: draft.dueDate || undefined,
      currency: draft.currency,
      entityName: draft.entityName.trim(),
      entityEmail: draft.entityEmail.trim() || undefined,
      entityAddress: draft.entityAddress.trim() || undefined,
      items,
      subtotal: totals.subtotal,
      taxRate: parseFloat(draft.taxRate) || 0,
      taxAmount: totals.taxAmount,
      globalDiscountValue: parseFloat(draft.globalDiscount) || 0,
      total: totals.total,
      notes: draft.notes.trim() || undefined,
    });
    onClose();
  };

  const noun = draft.type === 'quote' ? 'quote' : 'invoice';

  return (
    <FullPanel
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${noun}` : `New ${noun}`}
      description={draft.number}
      isDirty={isDirty}
      footer={close => (
        <div className="flex items-center justify-between gap-3">
          <span className="type-figure-row min-w-0 truncate text-ink">{formatCurrency(totals.total, draft.currency)}</span>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button onPress={save}>{isEditing ? 'Save changes' : `Save ${noun}`}</Button>
          </div>
        </div>
      )}
    >
      <form className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_300px]" onSubmit={event => { event.preventDefault(); save(); }}>
        <div className="min-w-0 space-y-4">
          <Section title="Details">
            {!isEditing && <SmoothTab fullWidth className="w-full" items={TYPES} value={draft.type} onChange={id => changeType(id as InvoiceType)} label="Document type" />}
            <SmoothTab fullWidth className="w-full" items={DIRECTIONS} value={draft.direction} onChange={id => update({ direction: id as InvoiceDirection })} label="Billing direction" />
            <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3">
              <TextInput label="Number" value={draft.number} onChange={number => update({ number })} />
              <Select label="Status" options={statusOptions} value={draft.status} onChange={id => update({ status: id as InvoiceStatus })} />
              <Select className="max-[599px]:col-span-2" label="Currency" options={CURRENCIES} value={draft.currency} onChange={id => update({ currency: id as Currency })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateInput label="Date" value={draft.date} onChange={date => update({ date })} />
              <DateInput label={draft.type === 'quote' ? 'Valid until' : 'Due'} value={draft.dueDate} onChange={dueDate => update({ dueDate })} />
            </div>
          </Section>

          <Section title={draft.direction === 'sent' ? 'Client' : 'Supplier'} aside={draft.entityName.trim() ? <BrandMark name={draft.entityName} /> : undefined}>
            <TextInput label="Name" value={draft.entityName} onChange={entityName => update({ entityName })} autoFocus={!isEditing} />
            <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
              <TextInput label="Email" type="email" value={draft.entityEmail} onChange={entityEmail => update({ entityEmail })} />
              <TextInput label="Address" value={draft.entityAddress} onChange={entityAddress => update({ entityAddress })} />
            </div>
          </Section>

          <Section title="Lines" aside={<Button variant="secondary" size="sm" icon="add-01" onPress={() => update({ lines: [...draft.lines, blankLine()] })}>Add line</Button>}>
            <ul className="divide-y divide-line">
              {draft.lines.map((line, index) => {
                const numbers = toNumbers(line);
                return (
                  <li key={line.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-end gap-1">
                      <TextInput className="min-w-0 flex-1" label={`Line ${index + 1}`} value={line.description} onChange={description => updateLine(line.id, { description })} />
                      <IconButton icon="delete-02" label={`Remove line ${index + 1}`} tooltipPlacement="left" onPress={() => removeLine(line.id)} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <TextInput label="Quantity" inputMode="decimal" value={line.quantity} onChange={quantity => updateLine(line.id, { quantity })} />
                      <AmountInput label="Price" value={line.unitPrice} onChange={unitPrice => updateLine(line.id, { unitPrice })} />
                      <TextInput label="Discount %" inputMode="decimal" value={line.discountPercent} onChange={discountPercent => updateLine(line.id, { discountPercent })} />
                    </div>
                    <p className="type-caption text-right text-muted">{formatCurrency(lineTotal(numbers.quantity, numbers.unitPrice, numbers.discountPercent), draft.currency)}</p>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="min-w-0 space-y-4 min-[900px]:sticky min-[900px]:top-0 min-[900px]:self-start">
          <Section title="Total">
            <dl className="space-y-2">
              <div className="flex justify-between gap-3"><dt className="type-body text-muted">Subtotal</dt><dd className="type-figure-row text-ink">{formatCurrency(totals.subtotal, draft.currency)}</dd></div>
              <AmountInput label="Discount" value={draft.globalDiscount} onChange={globalDiscount => update({ globalDiscount })} />
              <TextInput label="Tax rate (%)" inputMode="decimal" value={draft.taxRate} onChange={taxRate => update({ taxRate })} />
              <div className="flex justify-between gap-3"><dt className="type-body text-muted">Tax</dt><dd className="type-figure-row text-ink">{formatCurrency(totals.taxAmount, draft.currency)}</dd></div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2"><dt className="type-body-strong text-ink">Total</dt><dd className="type-figure-lg text-ink">{formatCurrency(totals.total, draft.currency)}</dd></div>
            </dl>
          </Section>
          <Textarea label="Notes and payment terms" rows={4} value={draft.notes} onChange={notes => update({ notes })} />
          {!!invoice?.paymentTerms?.length && (
            <Section title="Payment terms">
              <ul className="space-y-1">
                {invoice.paymentTerms.map(term => (
                  <li key={term.id} className="flex justify-between gap-3">
                    <span className="type-body min-w-0 truncate text-ink">{term.label}</span>
                    <span className="type-figure-row shrink-0 text-ink">{formatCurrency(term.amount, draft.currency)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </form>
    </FullPanel>
  );
};

export default InvoiceModal;
