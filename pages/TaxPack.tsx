import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { Checkbox, TextInput } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog, Dialog } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import SegmentedControl from '../components/ui/SegmentedControl';
import { Banner, EmptyState } from '../components/ui/States';
import { useAccountSelector, usePreferencesContext, useTransactionSelector, useWarrantsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useTagsContext } from '../contexts/FinancialDataContext';
import { convertToMain, getMainCurrency } from '../utils';
import { countryByCode, countryForCity, TAX_COUNTRIES, taxYearOf } from '../utils/taxCountries';
import { buildChecklist, buildTaxSummary, checklistCsv, salesCsv, summaryCsv, transactionsCsv, type ChecklistRow, type CostBasisMethod, type TaxLine } from '../utils/taxPack';
import { deleteTaxDocument, downloadTaxDocument, downloadTaxPack, listTaxDocuments, TaxApiError, updateTaxDocument, uploadTaxDocument, type TaxDocument, type TaxUsage } from '../utils/taxApi';
import type { InvestmentTransaction } from '../types';
import { cn } from '../lib/utils';

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
  const accounts = useAccountSelector(a => a);
  const { warrants } = useWarrantsContext();
  const { expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const currency = getMainCurrency();

  const scopedTransactions = useMemo(() => {
    const ids = new Set(accounts.filter(a => a.includeInAnalytics ?? true).map(a => a.id));
    return ids.size === 0 ? transactions : transactions.filter(tx => ids.has(tx.accountId));
  }, [transactions, accounts]);

  const fromCity = useMemo(() => countryForCity(defaultCity), [defaultCity]);
  const countryCode = preferences.taxPack?.country ?? fromCity ?? 'XX';
  const country = countryByCode(countryCode);
  const costBasisMethod: CostBasisMethod = preferences.taxPack?.costBasisMethod ?? 'average';
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentYear = taxYearOf(country, today);
  const [year, setYear] = useState<number>(currentYear - 1);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [usage, setUsage] = useState<TaxUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TaxDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<TaxDocument | null>(null);
  const [editDocLabel, setEditDocLabel] = useState('');
  const [editDocKey, setEditDocKey] = useState<string>('__other');
  const [isDeductibleOpen, setDeductibleOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const target = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const years = useMemo(() => {
    const seen = new Set<number>([currentYear, currentYear - 1]);
    for (const tx of scopedTransactions) seen.add(taxYearOf(country, tx.date.slice(0, 10)));
    return [...seen].filter(y => y >= 1990 && y <= currentYear).sort((a, b) => b - a);
  }, [scopedTransactions, country, currentYear]);

  const summary = useMemo(
    () =>
      buildTaxSummary({
        year,
        country,
        transactions: scopedTransactions,
        investmentTransactions,
        warrants,
        costBasisMethod,
        customDeductibleCategories: preferences.taxPack?.customDeductibleCategories,
        excludedDeductibleCategories: preferences.taxPack?.excludedDeductibleCategories,
        deductibleTagIds: preferences.taxPack?.deductibleTagIds,
        toMain: (amount, from) => convertToMain(amount, from),
      }),
    [year, country, scopedTransactions, investmentTransactions, warrants, costBasisMethod, preferences.taxPack],
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
  const requiredRows = checklist.filter(r => r.status !== 'optional');
  const attachedRequired = requiredRows.filter(r => r.status === 'have').length;
  const missing = checklist.filter(row => row.status === 'missing').length;
  const known = new Set(country.checklist.map(item => item.key));
  const other = docs.filter(doc => !doc.checklistKey || !known.has(doc.checklistKey));

  const uploadBatch = async (files: File[], key: string | null) => {
    for (const file of files) {
      setBusy(key ?? 'other');
      try {
        const item = country.checklist.find(entry => entry.key === key);
        await uploadTaxDocument(file, {
          year,
          label: item ? item.label : file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Document',
          checklistKey: key ?? undefined,
        });
        toast.success(`${file.name} saved, encrypted on your server.`);
      } catch (error) {
        toast.error(error instanceof TaxApiError ? error.message : 'Could not save the document.');
      }
    }
    setBusy(null);
    await reload();
  };

  const attach = (key: string | null) => { target.current = key; input.current?.click(); };
  const onFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    await uploadBatch(files, target.current);
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
    { name: `transactions-${summary.label}.csv`, content: transactionsCsv(scopedTransactions, summary) },
  ], summary.label));

  const saveEditDoc = async () => {
    if (!editingDoc || !editDocLabel.trim()) return;
    const nextKey = editDocKey === '__other' ? null : editDocKey;
    const docId = editingDoc.id;
    setEditingDoc(null);
    await run(docId, async () => {
      await updateTaxDocument(docId, { label: editDocLabel.trim(), checklistKey: nextKey });
      toast.success('Document updated');
      await reload();
    });
  };

  const flatExpenseCategories = useMemo(() => {
    const names: string[] = [];
    const visit = (list: typeof expenseCategories) => {
      list.forEach(c => {
        names.push(c.name);
        if (c.subCategories?.length) visit(c.subCategories);
      });
    };
    visit(expenseCategories || []);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [expenseCategories]);

  const keywords = useMemo(() => country.deductibleKeywords.map(k => k.toLowerCase()), [country.deductibleKeywords]);
  const customDedSet = useMemo(() => new Set((preferences.taxPack?.customDeductibleCategories ?? []).map(c => c.toLowerCase())), [preferences.taxPack?.customDeductibleCategories]);
  const excludedDedSet = useMemo(() => new Set((preferences.taxPack?.excludedDeductibleCategories ?? []).map(c => c.toLowerCase())), [preferences.taxPack?.excludedDeductibleCategories]);
  const tagDedSet = useMemo(() => new Set(preferences.taxPack?.deductibleTagIds ?? []), [preferences.taxPack?.deductibleTagIds]);

  const isCategoryDeductible = (catName: string) => {
    const lower = catName.toLowerCase();
    if (excludedDedSet.has(lower)) return false;
    return customDedSet.has(lower) || keywords.some(k => lower.includes(k));
  };

  const toggleDeductibleCategory = (catName: string, nextChecked: boolean) => {
    const lower = catName.toLowerCase();
    const matchesKeyword = keywords.some(k => lower.includes(k));
    const custom = new Set(preferences.taxPack?.customDeductibleCategories ?? []);
    const excluded = new Set(preferences.taxPack?.excludedDeductibleCategories ?? []);
    if (nextChecked) {
      excluded.delete(catName);
      if (!matchesKeyword) custom.add(catName);
    } else {
      custom.delete(catName);
      if (matchesKeyword) excluded.add(catName);
    }
    setPreferences({
      ...preferences,
      taxPack: {
        ...preferences.taxPack,
        customDeductibleCategories: [...custom],
        excludedDeductibleCategories: [...excluded],
      },
    });
  };

  const toggleDeductibleTag = (tagId: string, nextChecked: boolean) => {
    const set = new Set(preferences.taxPack?.deductibleTagIds ?? []);
    if (nextChecked) set.add(tagId);
    else set.delete(tagId);
    setPreferences({
      ...preferences,
      taxPack: { ...preferences.taxPack, deductibleTagIds: [...set] },
    });
  };

  const countryOptions = [...TAX_COUNTRIES.map(c => ({ id: c.code, label: c.name })), { id: 'XX', label: 'Other country' }];
  const hasData = summary.transactionCount > 0 || summary.sales.length > 0;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Tax pack"
        subtitle={`${country.name}, tax year ${summary.label}`}
        stats={[
          { label: 'Income', icon: 'arrow_downward', value: summary.incomeTotal + summary.investmentIncomeTotal, format: 'money', currency },
          { label: 'Deductible spending', icon: 'invoice-02', value: summary.deductibleTotal, format: 'money', currency },
          { label: 'Documents missing', icon: 'folder-01', value: missing, badge: requiredRows.length > 0 ? `${attachedRequired}/${requiredRows.length} ready` : undefined, badgeTone: missing === 0 ? 'pine' : 'butter' },
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
          <Block
            title="Spending in deductible categories"
            lines={summary.deductible}
            total={summary.deductibleTotal}
            currency={currency}
            empty="Nothing in the categories or tags marked as deductible."
            note={country.deductibleNote}
            action={<Button size="sm" variant="ghost" onPress={() => setDeductibleOpen(true)}>Customize</Button>}
          />
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="type-body-strong text-ink">Investment sales</h2>
              <SegmentedControl
                items={[{ id: 'average', label: 'Average cost' }, { id: 'fifo', label: 'FIFO' }]}
                activeId={costBasisMethod}
                onChange={id => setPreferences({ ...preferences, taxPack: { ...preferences.taxPack, costBasisMethod: id as CostBasisMethod } })}
              />
            </div>
            {summary.sales.length === 0 ? <p className="type-caption mt-2 text-muted">No sales in this year.</p> : (
              <>
                <ul className="mt-3 divide-y divide-line">
                  {summary.sales.map((sale, idx) => (
                    <li key={`${sale.date}-${sale.symbol}-${idx}`} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="type-body min-w-0 truncate text-ink">
                        {sale.symbol} <span className="type-caption text-muted">{sale.date} · {sale.quantity} sh</span>
                      </span>
                      <Amount value={sale.gain} currency={currency} tone="flow" className="type-body shrink-0" />
                    </li>
                  ))}
                </ul>
                <p className="type-caption mt-2 text-muted">
                  Proceeds <Amount value={summary.salesProceeds} currency={currency} className="type-caption" />, gain <Amount value={summary.salesGain} currency={currency} tone="flow" className="type-caption" /> ({costBasisMethod === 'fifo' ? 'FIFO' : 'average cost'}).
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Checklist & Document Vault */}
      <div className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="type-body-strong text-ink">What to gather</h2>
            <p className="type-caption mt-0.5 text-muted">Attach or drag-and-drop documents onto any row. Files stay encrypted on your server.</p>
          </div>
          {requiredRows.length > 0 && (
            <span className="type-caption font-semibold text-ink">
              {attachedRequired} of {requiredRows.length} needed attached
            </span>
          )}
        </div>

        {requiredRows.length > 0 && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-inset" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-all duration-[var(--duration-normal)]"
              style={{ width: `${Math.round((attachedRequired / requiredRows.length) * 100)}%` }}
            />
          </div>
        )}

        {loadError && <Banner tone="attention" className="mt-3">{loadError} You can still download the summary.</Banner>}

        <ul className="mt-3 divide-y divide-line">
          {checklist.map(row => {
            const isOver = dragKey === row.key;
            return (
              <li
                key={row.key}
                onDragOver={e => { e.preventDefault(); if (!loadError) setDragKey(row.key); }}
                onDragLeave={() => setDragKey(k => (k === row.key ? null : k))}
                onDrop={e => {
                  e.preventDefault();
                  setDragKey(null);
                  if (loadError) return;
                  const dropped = [...(e.dataTransfer?.files ?? [])];
                  if (dropped.length) void uploadBatch(dropped, row.key);
                }}
                className={cn('rounded-[var(--radius-md)] px-2 py-3 transition-colors', isOver && 'bg-primary-soft/60')}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="type-body-strong text-ink">{row.label}</span>
                      <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                    </div>
                    <p className="type-caption text-muted">{row.hint}</p>
                  </div>
                  <Button size="sm" variant="secondary" icon="upload-04" isBusy={busy === row.key} isDisabled={!!loadError} onPress={() => attach(row.key)}>
                    Attach
                  </Button>
                </div>
                <DocList
                  docs={docs.filter(doc => doc.checklistKey === row.key)}
                  onOpen={doc => run(doc.id, () => downloadTaxDocument(doc))}
                  onEdit={doc => { setEditingDoc(doc); setEditDocLabel(doc.label); setEditDocKey(doc.checklistKey ?? '__other'); }}
                  onDelete={setToDelete}
                />
              </li>
            );
          })}

          <li
            onDragOver={e => { e.preventDefault(); if (!loadError) setDragKey('__other'); }}
            onDragLeave={() => setDragKey(k => (k === '__other' ? null : k))}
            onDrop={e => {
              e.preventDefault();
              setDragKey(null);
              if (loadError) return;
              const dropped = [...(e.dataTransfer?.files ?? [])];
              if (dropped.length) void uploadBatch(dropped, null);
            }}
            className={cn('rounded-[var(--radius-md)] px-2 py-3 transition-colors', dragKey === '__other' && 'bg-primary-soft/60')}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="type-body-strong text-ink">Other documents</span>
                <p className="type-caption text-muted">Anything else your accountant may want.</p>
              </div>
              <Button size="sm" variant="secondary" icon="upload-04" isBusy={busy === 'other'} isDisabled={!!loadError} onPress={() => attach(null)}>Attach</Button>
            </div>
            <DocList
              docs={other}
              onOpen={doc => run(doc.id, () => downloadTaxDocument(doc))}
              onEdit={doc => { setEditingDoc(doc); setEditDocLabel(doc.label); setEditDocKey(doc.checklistKey ?? '__other'); }}
              onDelete={setToDelete}
            />
          </li>
        </ul>

        {usage && (
          <p className="type-caption mt-3 text-muted">
            {mb(usage.usedBytes)} of {mb(usage.maxBytes)} used across {usage.documents} {usage.documents === 1 ? 'document' : 'documents'}. PDF, PNG, JPG, WebP or text, up to {mb(usage.maxFileBytes)} each. Back up your server&apos;s documents folder separately from JSON backups.
          </p>
        )}
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={onFiles} />
      </div>

      {/* Customize Deductible Categories & Tags Dialog */}
      <Dialog
        isOpen={isDeductibleOpen}
        onClose={() => setDeductibleOpen(false)}
        title="Deductible categories & tags"
        description={`Defaults come from ${country.name}. Toggle any category or tag to include or exclude it from your deductible summary.`}
        footer={<div className="flex justify-end"><Button onPress={() => setDeductibleOpen(false)}>Done</Button></div>}
      >
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="type-label mb-2 text-muted">Expense categories</p>
            <div className="space-y-1.5">
              {flatExpenseCategories.map(catName => (
                <Checkbox key={catName} isSelected={isCategoryDeductible(catName)} onChange={checked => toggleDeductibleCategory(catName, checked)}>
                  {catName}
                </Checkbox>
              ))}
            </div>
          </div>
          {tags.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="type-label mb-2 text-muted">Tags (any tagged expense counts as deductible)</p>
              <div className="space-y-1.5">
                {tags.map(tag => (
                  <Checkbox key={tag.id} isSelected={tagDedSet.has(tag.id)} onChange={checked => toggleDeductibleTag(tag.id, checked)}>
                    #{tag.name}
                  </Checkbox>
                ))}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Edit / Move Attached Document Dialog */}
      <Dialog
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        title="Edit document"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onPress={() => setEditingDoc(null)}>Cancel</Button>
            <Button onPress={() => void saveEditDoc()} isDisabled={!editDocLabel.trim()}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextInput label="Label" value={editDocLabel} onChange={setEditDocLabel} autoFocus />
          <Select
            label="Checklist item"
            value={editDocKey}
            onChange={setEditDocKey}
            options={[
              ...country.checklist.map(c => ({ id: c.key, label: c.label })),
              { id: '__other', label: 'Other documents' },
            ]}
          />
        </div>
      </Dialog>

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

const taxYearLabel = (country: ReturnType<typeof countryByCode>, year: number) =>
  (country.yearStart.month === 1 && country.yearStart.day === 1 ? String(year) : `${year}/${String(year + 1).slice(2)}`);

const Block: React.FC<{
  title: string;
  lines: TaxLine[];
  total: number;
  currency: string;
  empty: string;
  note?: string;
  action?: React.ReactNode;
}> = ({ title, lines, total, currency, empty, note, action }) => {
  const [openCat, setOpenCat] = useState<string | null>(null);
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="type-body-strong text-ink">{title}</h2>
          {lines.length > 0 && <Amount value={total} currency={currency} className="type-body-strong" />}
        </div>
        {action}
      </div>
      {lines.length === 0 ? <p className="type-caption mt-2 text-muted">{empty}</p> : (
        <ul className="mt-3 divide-y divide-line">
          {lines.map(line => {
            const expandable = (line.items?.length ?? 0) > 0;
            const isOpen = openCat === line.category;
            return (
              <li key={line.category} className="py-1.5">
                <button
                  type="button"
                  disabled={!expandable}
                  aria-expanded={expandable ? isOpen : undefined}
                  onClick={() => setOpenCat(isOpen ? null : line.category)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-1 py-1.5 text-left transition-colors',
                    expandable && 'cursor-pointer hover:bg-inset/60',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {expandable && <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} className="shrink-0 text-muted" />}
                    <span className="type-body truncate text-ink">{line.category}</span>
                    <span className="type-caption text-muted">({line.count})</span>
                  </span>
                  <Amount value={line.total} currency={currency} className="type-body shrink-0 font-semibold" />
                </button>
                {isOpen && line.items && (
                  <ul className="mt-1 mb-1 ml-4 space-y-1 border-l border-line pl-3">
                    {line.items.map(item => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                        <span className="min-w-0 truncate text-muted">
                          <span className="text-ink">{item.merchant || item.description}</span> · {item.date}
                        </span>
                        <Amount value={item.amount} currency={currency} className="shrink-0 font-medium text-ink" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="type-caption mt-2 text-muted">{note}</p>}
    </div>
  );
};

const DocList: React.FC<{
  docs: TaxDocument[];
  onOpen: (doc: TaxDocument) => void;
  onEdit: (doc: TaxDocument) => void;
  onDelete: (doc: TaxDocument) => void;
}> = ({ docs, onOpen, onEdit, onDelete }) => docs.length === 0 ? null : (
  <ul className="mt-2 space-y-1">
    {docs.map(doc => (
      <li key={doc.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-inset px-3 py-1.5">
        <span className="type-caption min-w-0 truncate text-ink">
          <strong className="font-semibold">{doc.label}</strong>
          {doc.label !== doc.filename && <span className="text-muted"> · {doc.filename}</span>}
          <span className="text-muted"> ({mb(doc.size)})</span>
        </span>
        <span className="flex shrink-0 gap-1">
          <IconButton icon="edit-02" label={`Edit ${doc.filename}`} iconSize={16} onPress={() => onEdit(doc)} />
          <IconButton icon="download" label={`Download ${doc.filename}`} iconSize={16} onPress={() => onOpen(doc)} />
          <IconButton icon="delete" label={`Delete ${doc.filename}`} iconSize={16} onPress={() => onDelete(doc)} />
        </span>
      </li>
    ))}
  </ul>
);

export default TaxPack;
