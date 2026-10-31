import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Currency, Invoice } from '../../types';
import { documentNumber, documentTotals, effectiveStatus, invoiceFromQuote, invoiceSummary, lineTotal, visibleDocuments } from '../../utils/invoicesModel';

const doc = (extra: Partial<Invoice>) => ({ id: '1', type: 'invoice', direction: 'sent', number: 'INV-1', date: '2026-10-01', entityName: 'Acme', currency: 'EUR', items: [], subtotal: 0, taxAmount: 0, total: 100, status: 'sent', ...extra }) as Invoice;
const toEur = (amount: number, currency: Currency) => (currency === 'USD' ? amount * 0.5 : amount);
const today = '2026-10-31';

test('line discounts apply first, then the flat discount, then tax', () => {
  assert.equal(lineTotal(2, 50, 10), 90);
  assert.deepEqual(documentTotals([{ quantity: 2, unitPrice: 50, discountPercent: 10 }], 40, 20), { subtotal: 90, taxAmount: 10, total: 60 });
});

test('a flat discount larger than the subtotal stops at zero', () => {
  assert.equal(documentTotals([{ quantity: 1, unitPrice: 10 }], 50, 20).total, 0);
});

test('a sent invoice past its due date reads as overdue', () => {
  assert.equal(effectiveStatus(doc({ dueDate: '2026-10-30' }), today), 'overdue');
  assert.equal(effectiveStatus(doc({ dueDate: today }), today), 'sent');
  assert.equal(effectiveStatus(doc({ status: 'paid', dueDate: '2026-01-01' }), today), 'paid');
  assert.equal(effectiveStatus(doc({ type: 'quote', dueDate: '2026-01-01' }), today), 'sent');
});

test('totals convert each currency to EUR', () => {
  assert.equal(invoiceSummary([doc({}), doc({ currency: 'USD' })], today, toEur).outstanding, 150);
});

test('bills you received count as what you owe, never as income', () => {
  const summary = invoiceSummary([doc({ direction: 'received' }), doc({ direction: 'received', status: 'paid', date: today })], today, toEur);
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.paidThisMonth, 0);
  assert.equal(summary.youOwe, 100);
});

test('paid this month ignores the same month in other years', () => {
  const summary = invoiceSummary([doc({ status: 'paid', date: '2026-10-05' }), doc({ status: 'paid', date: '2025-10-05' })], today, toEur);
  assert.equal(summary.paidThisMonth, 100);
});

test('aging sorts open invoices by how late they are', () => {
  const summary = invoiceSummary([
    doc({ dueDate: '2026-11-15', total: 1 }),
    doc({ total: 2 }),
    doc({ dueDate: '2026-10-20', total: 4 }),
    doc({ dueDate: '2026-09-20', total: 8 }),
    doc({ dueDate: '2026-08-01', total: 16 }),
    doc({ status: 'overdue', total: 32 }),
    doc({ status: 'paid', dueDate: '2026-01-01', total: 64 }),
  ], today, toEur);
  assert.deepEqual(summary.aging.map(row => row.total), [3, 36, 8, 16]);
  assert.equal(summary.overdue, 60);
  assert.equal(summary.overdueCount, 4);
});

test('open quotes are counted apart from invoices', () => {
  const summary = invoiceSummary([doc({ type: 'quote' })], today, toEur);
  assert.equal(summary.openQuotes, 100);
  assert.equal(summary.outstanding, 0);
});

test('the list filters by type, shown status and search, newest first', () => {
  const docs = [doc({ id: 'a', date: '2026-01-01', dueDate: '2026-02-01' }), doc({ id: 'b', date: '2026-03-01', number: 'INV-9' }), doc({ id: 'c', type: 'quote' })];
  assert.deepEqual(visibleDocuments(docs, 'invoice', 'all', '', today).map(item => item.id), ['b', 'a']);
  assert.deepEqual(visibleDocuments(docs, 'invoice', 'overdue', '', today).map(item => item.id), ['a']);
  assert.deepEqual(visibleDocuments(docs, 'invoice', 'all', 'inv-9', today).map(item => item.id), ['b']);
});

test('a quote becomes a new draft invoice with no id', () => {
  const invoice = invoiceFromQuote(doc({ type: 'quote', status: 'sent', number: 'QT-1', total: 70 }), today, 1234567890);
  assert.equal('id' in invoice, false);
  assert.equal(invoice.type, 'invoice');
  assert.equal(invoice.status, 'draft');
  assert.equal(invoice.number, documentNumber('invoice', 1234567890));
  assert.equal(invoice.number, 'INV-567890');
  assert.equal(invoice.date, today);
  assert.equal(invoice.total, 70);
});
