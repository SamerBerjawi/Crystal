import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Currency, Invoice, Transaction } from '../../types';
import {
  buildInvoicePaymentTransaction,
  canRecordInvoiceInLedger,
  documentNumber,
  documentTotals,
  effectiveStatus,
  findLinkedTransaction,
  invoiceFromQuote,
  invoiceSummary,
  lineTotal,
  visibleDocuments,
} from '../../utils/invoicesModel';

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

test('buildInvoicePaymentTransaction creates income transaction for sent invoice and links both', () => {
  const invoice = doc({ id: 'inv-101', direction: 'sent', number: 'INV-101', entityName: 'Globex Corp', total: 250, currency: 'EUR' });
  const result = buildInvoicePaymentTransaction({
    invoice,
    accountId: 'acc-main',
    paymentDate: '2026-11-01',
    transactionId: 'tx-paid-1',
  });

  assert.equal(result.transaction.id, 'tx-paid-1');
  assert.equal(result.transaction.accountId, 'acc-main');
  assert.equal(result.transaction.date, '2026-11-01');
  assert.equal(result.transaction.amount, 250);
  assert.equal(result.transaction.type, 'income');
  assert.equal(result.transaction.category, 'Income');
  assert.equal(result.transaction.currency, 'EUR');
  assert.equal(result.transaction.merchant, 'Globex Corp');
  assert.equal(result.transaction.linkedInvoiceId, 'inv-101');

  assert.equal(result.updatedInvoice.status, 'paid');
  assert.equal(result.updatedInvoice.paidDate, '2026-11-01');
  assert.equal(result.updatedInvoice.paymentAccountId, 'acc-main');
  assert.equal(result.updatedInvoice.linkedTransactionId, 'tx-paid-1');
});

test('buildInvoicePaymentTransaction creates expense transaction for received bill', () => {
  const bill = doc({ id: 'bill-202', direction: 'received', number: 'BILL-202', entityName: 'Hosting Ltd', total: 80, currency: 'USD' });
  const result = buildInvoicePaymentTransaction({
    invoice: bill,
    accountId: 'acc-usd',
    paymentDate: '2026-11-05',
    category: 'Technology',
  });

  assert.ok(result.transaction.id.startsWith('txn-'));
  assert.equal(result.transaction.accountId, 'acc-usd');
  assert.equal(result.transaction.amount, -80);
  assert.equal(result.transaction.type, 'expense');
  assert.equal(result.transaction.category, 'Technology');
  assert.equal(result.transaction.currency, 'USD');
  assert.equal(result.transaction.linkedInvoiceId, 'bill-202');

  assert.equal(result.updatedInvoice.status, 'paid');
  assert.equal(result.updatedInvoice.linkedTransactionId, result.transaction.id);
});

test('canRecordInvoiceInLedger only returns true for paid invoices without an existing ledger link', () => {
  const sentDraft = doc({ id: '1', type: 'invoice', status: 'draft' });
  const sentOpen = doc({ id: '2', type: 'invoice', status: 'sent' });
  const sentPaidNoLink = doc({ id: '3', type: 'invoice', status: 'paid' });
  const sentPaidLinked = doc({ id: '4', type: 'invoice', status: 'paid', linkedTransactionId: 'tx-1' });
  const quotePaid = doc({ id: '5', type: 'quote', status: 'accepted' });

  assert.equal(canRecordInvoiceInLedger(sentDraft), false);
  assert.equal(canRecordInvoiceInLedger(sentOpen), false);
  assert.equal(canRecordInvoiceInLedger(sentPaidNoLink), true);
  assert.equal(canRecordInvoiceInLedger(sentPaidLinked), false);
  assert.equal(canRecordInvoiceInLedger(quotePaid), false);
});

test('findLinkedTransaction resolves transaction by linkedTransactionId or linkedInvoiceId', () => {
  const tx1 = { id: 'tx-100', accountId: 'a1', date: today, description: 'Test', amount: 100, category: 'Income', type: 'income', currency: 'EUR' } as Transaction;
  const tx2 = { id: 'tx-200', linkedInvoiceId: 'inv-200', accountId: 'a1', date: today, description: 'Test 2', amount: 200, category: 'Income', type: 'income', currency: 'EUR' } as Transaction;
  const transactions = [tx1, tx2];

  const invoiceLinkedDirect = doc({ id: 'inv-100', linkedTransactionId: 'tx-100' });
  const invoiceLinkedReverse = doc({ id: 'inv-200' });
  const invoiceUnlinked = doc({ id: 'inv-300' });

  assert.equal(findLinkedTransaction(invoiceLinkedDirect, transactions), tx1);
  assert.equal(findLinkedTransaction(invoiceLinkedReverse, transactions), tx2);
  assert.equal(findLinkedTransaction(invoiceUnlinked, transactions), undefined);
});

