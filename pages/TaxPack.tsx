import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { Select } from '../components/ui/Pickers';
import { Amount } from '../components/ui/Money';
import { Banner, EmptyState } from '../components/ui/States';
import { ConfirmDialog } from '../components/ui/Overlays';
import { usePreferencesContext, useTransactionSelector } from '../contexts/DomainProviders';
import { convertToMain, getMainCurrency } from '../utils';
import { countryByCode, countryForCity, TAX_COUNTRIES, taxYearOf } from '../utils/taxCountries';
import { buildChecklist, buildTaxSummary, checklistCsv, salesCsv, summaryCsv, transactionsCsv, type ChecklistRow } from '../utils/taxPack';
import { deleteTaxDocument, downloadTaxDocument, downloadTaxPack, listTaxDocuments, TaxApiError, uploadTaxDocument, type TaxDocument, type TaxUsage } from '../utils/taxApi';
import type { InvestmentTransaction } from '../types';

const CARD = 'surface-card min-w-0 rounded-[var(--radius-xl)] p-5 border border-line';
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp,text/plain';

const STATUS: Record<ChecklistRow['status'], { tone: 'positive' | 'attention' | 'neutral'; label: string }> = {
  have: { tone: 'positive', label: 'Attached' },
  missing: { tone: 'attention', label: 'Missing' },
  optional: { tone: 'neutral', label: 'Not needed by your data' },
};

/** A tax year's income and deductible spending, what the investments did, a checklist for your country, and the documents to go with it. */
const TaxPack: React.FC<{ defaultCity?: string; investmentTransactions: InvestmentTransaction[] }> = ({ defaultCity, investmentTransactions }) => {
  const transactions = useTransactionSelector(tx => tx);
  const { preferences, setPreferences } = usePreferencesContext();
  const currency = getMainCurrency();

  const fromCity = useMemo(() => countryForCity(defaultCity), [defaultCity]);
  const countryCode = preferences.taxPack?.country ?? fromCity ?? 'XX';
  const country = countryByCode(countryCode);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentYear = taxYearOf(country, today);
  const [year, setYear] = useState<number>(currentYear - 1);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [usage, setUsage] = useState<TaxUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TaxDocument | null>(null);
  const target = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const years = useMemo(() => {
    const seen = new Set<number>([currentYear, currentYear - 1]);
    for (const tx of transactions) seen.add(taxYearOf(country, tx.date.slice(0, 10)));
    return [...seen].filter(y => y >= 1990 && y <= currentYear).sort((a, b) => b - a);
  }, [transactions, country, currentYear]);

  const summary = useMemo(
    () => buildTaxSummary({ year, country, transactions, investmentTransactions, toMain: (amount, from) => convertToMain(amount, from) }),
    [year, country, transactions, investmentTransactions],
  );

  const reload = useCallback(async () => {
    try {
      const result = await listTaxDocuments(year);
      setDocs(result.documents);
      setUsage(result.usage);
      setLoadError(null);
    } catch (error) {
      setDocs([]);
      setLoadError(error instanceof TaxApiError ? error.message : 'Could not load the documents.');
    }
  }, [year]);
  useEffect(() => { void reload(); }, [reload]);

  const checklist = useMemo(() => buildChecklist(country, summary, docs), [country, summary, docs]);
  const missing = checklist.filter(row => row.status === 'missing').length;
  const known = new Set(country.checklist.map(item => item.key));
  const other = docs.filter(doc => !doc.checklistKey || !known.has(doc.checklistKey));

  const attach = (key: string | null) => { target.current = key; input.current?.click(); };
  const onFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const key = target.current;
    for (const file of files) {
      setBusy(key ?? 'other');
      try {
        const item = country.checklist.find(entry => entry.key === key);
        await uploadTaxDocument(file, { year, label: item ? item.label : file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Document', checklistKey: key ?? undefined });
        toast.success(`${file.name} saved, encrypted on your server.`);
      } catch (error) {
        toast.error(error instanceof TaxApiError ? error.message : 'Could not save the document.');
      }
    }
    setBusy(null);
    await reload();
  };

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try { await action(); } catch (error) { toast.error(error instanceof TaxApiError ? error.message : 'Something went wrong.'); }
    setBusy(null);
  };

  const exportPack = () => run('export', () => downloadTaxPack(year, [
    { name: `summary-${summary.label}.csv`, content: summaryCsv(summary, country, currency) },
    { name: `checklist-${summary.label}.csv`, content: checklistCsv(checklist) },
    { name: `investment-sales-${summary.label}.csv`, content: salesCsv(summary) },
    { name: `transactions-${summary.label}.csv`, content: transactionsCsv(transactions, summary) },
  ], summary.label));

  const countryOptions = [...TAX_COUNTRIES.map(c => ({ id: c.code, label: c.name })), { id: 'XX', label: 'Other country' }];
  const hasData = summary.transactionCount > 0 || summary.sales.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax pack"
        subtitle={`${country.name}, tax year ${summary.label}`}
        stats={[
          { label: 'Income', icon: 'arrow_downward', value: summary.incomeTotal + summary.investmentIncomeTotal, format: 'money', currency },
          { label: 'Deductible spending', icon: 'invoice-02', value: summary.deductibleTotal, format: 'money', currency },
          { label: 'Documents missing', icon: 'folder-01', value: missing },
        ]}
        actions={<Button icon="download" isBusy={busy === 'export'} onPress={exportPack}>Download pack</Button>}
      />

      <div className={CARD}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Country"
            value={countryCode}
            options={countryOptions}
            onChange={id => setPreferences({ ...preferences, taxPack: { ...preferences.taxPack, country: id } })}
            help={preferences.taxPack?.country ? 'Chosen here. It overrides the city in Settings.' : fromCity ? `Read from your city in Settings (${defaultCity}).` : defaultCity ? `Could not tell the country from "${defaultCity}". Choose one.` : 'Set your city in Settings to fill this in, or choose a country.'}
          />
          <Select label="Tax year" value={String(year)} options={years.map(y => ({ id: String(y), label: taxYearLabel(country, y) }))} onChange={id => setYear(Number(id))} help={`${country.authority}. ${country.deadline}`} />
        </div>
        <p className="type-caption mt-3 text-muted">A guide to the paperwork, worked out from your own records. It is not tax advice or a return, and rules depend on your situation. Check with {country.authority}.</p>
      </div>

      {!hasData && <EmptyState icon="invoice-02" title={`Nothing recorded for ${summary.label}`} description="Income, deductible spending and investment sales for the year appear here once you have transactions in it. You can still attach documents." />}

      {hasData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Block title="Income" lines={summary.income} total={summary.incomeTotal} currency={currency} empty="No income in this year." />
          <Block title="Investment income" lines={summary.investmentIncome} total={summary.investmentIncomeTotal} currency={currency} empty="No dividends or interest found. They are found by the category or description." />
          <Block title="Spending in deductible categories" lines={summary.deductible} total={summary.deductibleTotal} currency={currency} empty="Nothing in the categories this country usually allows." note={country.deductibleNote} />
          <div className={CARD}>
            <h2 className="type-body-strong text-ink">Investment sales</h2>
            {summary.sales.length === 0 ? <p className="type-caption mt-2 text-muted">No sales in this year.</p> : (
              <>
                <ul className="mt-3 divide-y divide-line">
                  {summary.sales.map(sale => (
                    <li key={`${sale.date}${sale.symbol}${sale.quantity}`} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="type-body min-w-0 truncate text-ink">{sale.symbol} <span className="type-caption text-muted">{sale.date}</span></span>
                      <Amount value={sale.gain} currency={currency} tone="flow" className="type-body shrink-0" />
                    </li>
                  ))}
                </ul>
                <p className="type-caption mt-2 text-muted">Proceeds <Amount value={summary.salesProceeds} currency={currency} className="type-caption" />, gain <Amount value={summary.salesGain} currency={currency} tone="flow" className="type-caption" />. Cost by average price; your country may use another method.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className={CARD}>
        <h2 className="type-body-strong text-ink">What to gather</h2>
        <p className="type-caption mt-1 text-muted">Attach each document here. Files are encrypted on your server, and the pack downloads them with the summary.</p>
        {loadError && <Banner tone="attention" className="mt-3">{loadError} You can still download the summary.</Banner>}
        <ul className="mt-3 divide-y divide-line">
          {checklist.map(row => (
            <li key={row.key} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="type-body-strong text-ink">{row.label}</span><Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge></div>
                  <p className="type-caption text-muted">{row.hint}</p>
                </div>
                <Button size="sm" variant="secondary" icon="upload-04" isBusy={busy === row.key} isDisabled={!!loadError} onPress={() => attach(row.key)}>Attach</Button>
              </div>
              <DocList docs={docs.filter(doc => doc.checklistKey === row.key)} onOpen={doc => run(doc.id, () => downloadTaxDocument(doc))} onDelete={setToDelete} />
            </li>
          ))}
          <li className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><span className="type-body-strong text-ink">Other documents</span><p className="type-caption text-muted">Anything else your accountant may want.</p></div>
              <Button size="sm" variant="secondary" icon="upload-04" isBusy={busy === 'other'} isDisabled={!!loadError} onPress={() => attach(null)}>Attach</Button>
            </div>
            <DocList docs={other} onOpen={doc => run(doc.id, () => downloadTaxDocument(doc))} onDelete={setToDelete} />
          </li>
        </ul>
        {usage && <p className="type-caption mt-3 text-muted">{mb(usage.usedBytes)} of {mb(usage.maxBytes)} used across {usage.documents} {usage.documents === 1 ? 'document' : 'documents'}. PDF, PNG, JPG, WebP or text, up to {mb(usage.maxFileBytes)} each.</p>}
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={onFiles} />
      </div>

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this document?"
        message={toDelete ? `${toDelete.filename} is removed from your server and cannot be recovered, except from a backup.` : ''}
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => { const doc = toDelete; setToDelete(null); if (doc) void run(doc.id, async () => { await deleteTaxDocument(doc.id); await reload(); }); }}
      />
    </div>
  );
};

const taxYearLabel = (country: ReturnType<typeof countryByCode>, year: number) => (country.yearStart.month === 1 && country.yearStart.day === 1 ? String(year) : `${year}/${String(year + 1).slice(2)}`);

const Block: React.FC<{ title: string; lines: { category: string; total: number; count: number }[]; total: number; currency: string; empty: string; note?: string }> = ({ title, lines, total, currency, empty, note }) => (
  <div className={CARD}>
    <div className="flex items-baseline justify-between gap-3"><h2 className="type-body-strong text-ink">{title}</h2>{lines.length > 0 && <Amount value={total} currency={currency} className="type-body-strong" />}</div>
    {lines.length === 0 ? <p className="type-caption mt-2 text-muted">{empty}</p> : (
      <ul className="mt-3 divide-y divide-line">
        {lines.map(line => (
          <li key={line.category} className="flex items-baseline justify-between gap-3 py-2">
            <span className="type-body min-w-0 truncate text-ink">{line.category} <span className="type-caption text-muted">{line.count}</span></span>
            <Amount value={line.total} currency={currency} className="type-body shrink-0" />
          </li>
        ))}
      </ul>
    )}
    {note && <p className="type-caption mt-2 text-muted">{note}</p>}
  </div>
);

const DocList: React.FC<{ docs: TaxDocument[]; onOpen: (doc: TaxDocument) => void; onDelete: (doc: TaxDocument) => void }> = ({ docs, onOpen, onDelete }) => docs.length === 0 ? null : (
  <ul className="mt-2 space-y-1">
    {docs.map(doc => (
      <li key={doc.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-inset px-3 py-1.5">
        <span className="type-caption min-w-0 truncate text-ink">{doc.filename} <span className="text-muted">{mb(doc.size)}</span></span>
        <span className="flex shrink-0 gap-1">
          <IconButton icon="download" label={`Download ${doc.filename}`} iconSize={16} onPress={() => onOpen(doc)} />
          <IconButton icon="delete" label={`Delete ${doc.filename}`} iconSize={16} onPress={() => onDelete(doc)} />
        </span>
      </li>
    ))}
  </ul>
);

export default TaxPack;
