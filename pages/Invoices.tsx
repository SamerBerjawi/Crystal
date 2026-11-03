import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Currency, Invoice, InvoiceStatus, InvoiceType } from '../types';
import { convertToMain, parseLocalDate, toLocalISOString, getMainCurrency } from '../utils';
import { effectiveStatus, INVOICE_STATUSES, invoiceFromQuote, invoiceSummary, QUOTE_STATUSES, STATUS_LABELS, visibleDocuments } from '../utils/invoicesModel';
import { useInvoicesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { useIsMobile } from '../hooks/useIsMobile';
import InvoiceModal from '../components/InvoiceModal';
import PageHeader, { type PageStat } from '../components/PageHeader';
import { BrandMark } from '../components/ServiceCard';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, ShowMore } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import { Menu, type MenuAction } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';

const PAGE_SIZE = 10;
const TYPES = [{ id: 'invoice', label: 'Invoices' }, { id: 'quote', label: 'Quotes' }];
const STATUS_TONES: Record<InvoiceStatus, 'neutral' | 'blue' | 'positive' | 'negative'> = { draft: 'neutral', sent: 'blue', paid: 'positive', overdue: 'negative', accepted: 'positive', rejected: 'neutral' };
/** Later buckets get hotter, so colour reads as urgency. */
const AGING_COLORS: Record<string, string> = { current: 'var(--chart-3)', days30: 'var(--amber)', days60: 'var(--chart-2)', older: 'var(--money-out)' };

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const DocumentRow: React.FC<{ doc: Invoice; today: string; isPhone: boolean; menu: MenuAction[]; onOpen: () => void }> = ({ doc, today, isPhone, menu, onOpen }) => {
  const status = effectiveStatus(doc, today);
  const due = doc.dueDate ? `Due ${shortDate(doc.dueDate)}` : shortDate(doc.date);
  const actions = <Menu title={doc.number} trigger={<IconButton icon="more-horizontal" label={`Actions for ${doc.number}`} tooltipPlacement="left" />} items={menu} />;
  const identity = (
    <span className="flex min-w-0 items-center gap-3">
      <BrandMark name={doc.entityName} />
      <span className="min-w-0">
        <span className="type-body-strong block truncate text-ink">{doc.entityName}</span>
        <span className="type-caption block truncate text-muted">{doc.number}{doc.direction === 'received' ? ', bill to pay' : ''}</span>
      </span>
    </span>
  );

  if (isPhone) {
    return (
      <li className="flex items-center gap-1">
        <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 py-1.5 text-left">
          {identity}
          <span className="shrink-0 text-right">
            <span className="type-figure-row block text-ink"><Amount value={doc.total} currency={doc.currency} /></span>
            <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
          </span>
        </button>
        {actions}
      </li>
    );
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="max-w-72 py-2 pr-3"><button type="button" onClick={onOpen} className="block w-full min-w-0 cursor-pointer text-left">{identity}</button></td>
      <td className="px-3 py-2"><Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge></td>
      <td className="type-caption px-3 py-2 text-muted">{due}</td>
      <td className="type-figure-row px-3 py-2 text-right text-ink"><Amount value={doc.total} currency={doc.currency} /></td>
      <td className="py-2 text-right">{actions}</td>
    </tr>
  );
};

/** Talvo's aging above a table of documents. Phones get rows, and editing is a full-height sheet (D-017). */
const InvoicesPage: React.FC = () => {
  const { invoices, saveInvoice, deleteInvoice } = useInvoicesContext();
  const rates = usePreferencesSelector(p => p.conversionRates);
  const isPhone = useIsMobile();
  const today = toLocalISOString(new Date());
  const [type, setType] = useState<InvoiceType>('invoice');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [editor, setEditor] = useState<{ type: InvoiceType; invoice?: Invoice } | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [converting, setConverting] = useState<Invoice | null>(null);

  useEffect(() => setShown(PAGE_SIZE), [type, status, search]);

  const summary = useMemo(() => invoiceSummary(invoices, today, (amount: number, currency: Currency) => convertToMain(amount, currency, rates)), [invoices, today, rates]);
  const documents = useMemo(() => visibleDocuments(invoices, type, status, search, today), [invoices, type, status, search, today]);
  const openTotal = summary.aging.reduce((sum, bucket) => sum + bucket.total, 0);

  const convert = (quote: Invoice) => {
    saveInvoice(invoiceFromQuote(quote, today, Date.now()));
    saveInvoice({ ...quote, status: 'accepted' });
    setType('invoice');
    setStatus('all');
    toast.success('Draft invoice created');
  };

  const save = (doc: Omit<Invoice, 'id'> & { id?: string }) => {
    saveInvoice(doc);
    setType(doc.type);
    setStatus('all');
  };

  const menuFor = (doc: Invoice): MenuAction[] => [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setEditor({ type: doc.type, invoice: doc }) },
    ...(doc.type === 'quote' ? [{ id: 'convert', label: 'Turn into invoice', icon: 'invoice-02', onAction: () => (doc.status === 'accepted' ? setConverting(doc) : convert(doc)) }] : []),
    { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setDeleting(doc) },
  ];

  const stats: PageStat[] = [
    { label: 'Paid this month', icon: 'checkmark-circle-02', value: summary.paidThisMonth, format: 'money', currency: getMainCurrency() },
    { label: 'Outstanding', icon: 'clock-01', value: summary.outstanding, format: 'money', currency: getMainCurrency() },
    { label: 'Overdue', icon: 'alert-02', value: summary.overdue, format: 'money', currency: getMainCurrency(), ...(summary.overdueCount > 0 ? { badge: `${summary.overdueCount} late`, badgeTone: 'tomato' as const } : {}) },
  ];

  const statusItems = [{ id: 'all', label: 'All' }, ...(type === 'quote' ? QUOTE_STATUSES : INVOICE_STATUSES).map(id => ({ id, label: STATUS_LABELS[id] }))];

  return (
    <div className="space-y-6 pb-8 max-md:space-y-4">
      <PageHeader
        title="Invoices"
        stats={stats}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onPress={() => setEditor({ type: 'quote' })}>New quote</Button>
            <Button icon="add-01" onPress={() => setEditor({ type: 'invoice' })}>New invoice</Button>
          </div>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState icon="invoice-01" title="No invoices yet" description="Draft a quote or an invoice, and follow it until it's paid." actionLabel="New invoice" onAction={() => setEditor({ type: 'invoice' })} secondaryActionLabel="New quote" onSecondaryAction={() => setEditor({ type: 'quote' })} />
      ) : (
        <>
          <section aria-label="Money owed to you" className="surface-card rounded-[var(--radius-xl)] p-6 max-md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="type-card-title text-ink">Money owed to you</h2>
              <p className="type-caption text-muted">
                <Amount value={summary.openQuotes} currency={getMainCurrency()} /> in open quotes, and you owe <Amount value={summary.youOwe} currency={getMainCurrency()} />
              </p>
            </div>
            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-inset" aria-hidden>
              {summary.aging.filter(bucket => bucket.total > 0).map(bucket => <span key={bucket.id} className="h-full" style={{ width: `${(bucket.total / openTotal) * 100}%`, background: AGING_COLORS[bucket.id] }} />)}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 min-[900px]:grid-cols-4">
              {summary.aging.map(bucket => (
                <div key={bucket.id}>
                  <dt className="type-label flex items-center gap-1.5 text-muted"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: AGING_COLORS[bucket.id] }} />{bucket.label}</dt>
                  <dd className="type-figure-row text-ink"><Amount value={bucket.total} currency={getMainCurrency()} /></dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Documents" className="surface-card min-w-0 rounded-[var(--radius-xl)] p-6 max-md:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <SegmentedControl items={TYPES} activeId={type} onChange={id => { setType(id as InvoiceType); setStatus('all'); }} />
              <TextInput className="min-w-0 flex-1 md:max-w-xs" label="Search" placeholder="Name or number" value={search} onChange={setSearch} />
              <SegmentedControl scrollable items={statusItems} activeId={status} onChange={id => setStatus(id as InvoiceStatus | 'all')} />
            </div>
            {documents.length === 0 ? (
              <p className="type-body py-10 text-center text-muted">Nothing matches this view.</p>
            ) : isPhone ? (
              <ul className="mt-2 divide-y divide-line">
                {documents.slice(0, shown).map(doc => <DocumentRow key={doc.id} doc={doc} today={today} isPhone menu={menuFor(doc)} onOpen={() => setEditor({ type: doc.type, invoice: doc })} />)}
              </ul>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className="type-label py-2 pr-3 text-muted">Name</th>
                      <th scope="col" className="type-label px-3 py-2 text-muted">Status</th>
                      <th scope="col" className="type-label px-3 py-2 text-muted">Date</th>
                      <th scope="col" className="type-label px-3 py-2 text-right text-muted">Total</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.slice(0, shown).map(doc => <DocumentRow key={doc.id} doc={doc} today={today} isPhone={false} menu={menuFor(doc)} onOpen={() => setEditor({ type: doc.type, invoice: doc })} />)}
                  </tbody>
                </table>
              </div>
            )}
            <ShowMore remaining={documents.length - shown} onPress={() => setShown(count => count + PAGE_SIZE)} />
          </section>
        </>
      )}

      {editor && <InvoiceModal invoice={editor.invoice} initialType={editor.type} onSave={save} onClose={() => setEditor(null)} />}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteInvoice(deleting.id); setDeleting(null); }}
        title={`Delete ${deleting?.number ?? 'this document'}?`}
        message="You can't undo this."
        confirmLabel="Delete"
        isDestructive
      />
      <ConfirmDialog
        isOpen={!!converting}
        onClose={() => setConverting(null)}
        onConfirm={() => { if (converting) convert(converting); setConverting(null); }}
        title="Create another invoice?"
        message="This quote is already accepted, so it may have an invoice."
        confirmLabel="Create invoice"
      />
    </div>
  );
};

export default InvoicesPage;
