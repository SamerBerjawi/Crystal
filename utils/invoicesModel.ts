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
    paidThisMonth: inEur(
      billed.filter(
        doc =>
          doc.type === 'invoice' &&
          doc.status === 'paid' &&
          (doc.date.slice(0, 7) === month || doc.dueDate?.slice(0, 7) === month)
      )
    ),
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const renderPrintableInvoiceHtml = (doc: Invoice, formatMoney: (val: number, cur: Currency) => string): string => {
  const title = doc.type === 'quote' ? 'Quote' : 'Invoice';
  const rowsHtml = doc.items
    .map(
      item => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.description || '—')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatMoney(item.unitPrice, doc.currency))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.discountPercent ? `${item.discountPercent}%` : '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${escapeHtml(formatMoney(item.total, doc.currency))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} ${escapeHtml(doc.number)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 40px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    h1 { margin: 0; font-size: 28px; }
    .meta { color: #475569; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .totals { margin-top: 24px; margin-left: auto; width: 280px; font-size: 14px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals-final { font-size: 18px; font-weight: 700; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 6px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">#${escapeHtml(doc.number)} · ${escapeHtml(STATUS_LABELS[doc.status])}</div>
    </div>
    <div class="meta" style="text-align:right;">
      <div><strong>Date:</strong> ${escapeHtml(doc.date)}</div>
      ${doc.dueDate ? `<div><strong>${doc.type === 'quote' ? 'Valid until' : 'Due'}:</strong> ${escapeHtml(doc.dueDate)}</div>` : ''}
    </div>
  </div>
  <div class="meta" style="margin-bottom:24px;">
    <strong>${doc.direction === 'sent' ? 'Billed To' : 'From'}:</strong><br/>
    ${escapeHtml(doc.entityName)}<br/>
    ${doc.entityEmail ? `${escapeHtml(doc.entityEmail)}<br/>` : ''}
    ${doc.entityAddress ? `${escapeHtml(doc.entityAddress)}` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Discount</th>
        <th style="text-align:right;">Line Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(doc.subtotal, doc.currency))}</span></div>
    ${doc.globalDiscountValue ? `<div class="totals-row"><span>Discount</span><span>−${escapeHtml(formatMoney(doc.globalDiscountValue, doc.currency))}</span></div>` : ''}
    <div class="totals-row"><span>Tax (${doc.taxRate}%)</span><span>${escapeHtml(formatMoney(doc.taxAmount, doc.currency))}</span></div>
    <div class="totals-row totals-final"><span>Total</span><span>${escapeHtml(formatMoney(doc.total, doc.currency))}</span></div>
  </div>
  ${doc.notes ? `<div class="meta" style="margin-top:32px;"><strong>Notes:</strong><br/>${escapeHtml(doc.notes)}</div>` : ''}
</body>
</html>`;
};
