import type { Currency, Invoice, InvoiceItem, InvoiceStatus, InvoiceType } from '../types';
import { parseLocalDate } from '../utils';

export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];
export const QUOTE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'accepted', 'rejected'];
export const STATUS_LABELS: Record<InvoiceStatus, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', accepted: 'Accepted', rejected: 'Rejected' };

export const documentNumber = (type: InvoiceType, now: number) => `${type === 'quote' ? 'QT' : 'INV'}-${now.toString().slice(-6)}`;

export const lineTotal = (quantity: number, unitPrice: number, discountPercent = 0) => quantity * unitPrice * (1 - discountPercent / 100);

/** Line discounts come off first, then the flat discount, and tax is charged on what's left. */
export const documentTotals = (items: Pick<InvoiceItem, 'quantity' | 'unitPrice' | 'discountPercent'>[], globalDiscount: number, taxRate: number) => {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice, item.discountPercent), 0);
  const taxable = Math.max(0, subtotal - globalDiscount);
  const taxAmount = taxable * (taxRate / 100);
  return { subtotal, taxAmount, total: taxable + taxAmount };
};

const daysPastDue = (doc: Invoice, today: string) =>
  doc.dueDate ? Math.round((parseLocalDate(today).getTime() - parseLocalDate(doc.dueDate).getTime()) / 86400000) : 0;

/** A sent invoice past its due date reads as overdue, without changing what's saved. */
export const effectiveStatus = (doc: Invoice, today: string): InvoiceStatus =>
  doc.type === 'invoice' && doc.status === 'sent' && daysPastDue(doc, today) > 0 ? 'overdue' : doc.status;

const isOpen = (doc: Invoice, today: string) => {
  const status = effectiveStatus(doc, today);
  return doc.type === 'invoice' && (status === 'sent' || status === 'overdue');
};

export const AGING_BUCKETS = [
  { id: 'current', label: 'Not due yet' },
  { id: 'days30', label: '1 to 30 days late' },
  { id: 'days60', label: '31 to 60 days late' },
  { id: 'older', label: 'Over 60 days late' },
] as const;

const bucketOf = (doc: Invoice, today: string) => {
  const late = daysPastDue(doc, today);
  return effectiveStatus(doc, today) !== 'overdue' ? 'current' : late > 60 ? 'older' : late > 30 ? 'days60' : 'days30';
};

/** What you're owed and what you owe, in EUR, so currencies never mix and bills never count as income. */
export const invoiceSummary = (invoices: Invoice[], today: string, toEur: (amount: number, currency: Currency) => number) => {
  const inEur = (docs: Invoice[]) => docs.reduce((sum, doc) => sum + toEur(doc.total, doc.currency), 0);
  const billed = invoices.filter(doc => doc.direction === 'sent');
  const open = billed.filter(doc => isOpen(doc, today));
  const overdue = open.filter(doc => effectiveStatus(doc, today) === 'overdue');
  const month = today.slice(0, 7);
  return {
    paidThisMonth: inEur(billed.filter(doc => doc.type === 'invoice' && doc.status === 'paid' && doc.date.slice(0, 7) === month)),
    outstanding: inEur(open),
    overdue: inEur(overdue),
    overdueCount: overdue.length,
    youOwe: inEur(invoices.filter(doc => doc.direction === 'received' && isOpen(doc, today))),
    openQuotes: inEur(billed.filter(doc => doc.type === 'quote' && doc.status === 'sent')),
    aging: AGING_BUCKETS.map(bucket => {
      const docs = open.filter(doc => bucketOf(doc, today) === bucket.id);
      return { ...bucket, total: inEur(docs), count: docs.length };
    }),
  };
};

export const visibleDocuments = (invoices: Invoice[], type: InvoiceType, status: InvoiceStatus | 'all', search: string, today: string) => {
  const query = search.trim().toLowerCase();
  return invoices
    .filter(doc => doc.type === type && (status === 'all' || effectiveStatus(doc, today) === status))
    .filter(doc => !query || doc.entityName.toLowerCase().includes(query) || doc.number.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));
};

/** A new draft invoice from a quote. It has no id, so saving creates a document and leaves the quote in place. */
export const invoiceFromQuote = (quote: Invoice, today: string, now: number): Omit<Invoice, 'id'> => {
  const { id: _id, ...fields } = quote;
  return { ...fields, type: 'invoice', status: 'draft', number: documentNumber('invoice', now), date: today };
};
