import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Account, Transaction, Budget, RecurringTransaction, ImportExportHistoryItem, HistoryStatus, ImportDataType, Category, FinancialData, Page } from '../types';
import ExportModal from '../components/ExportModal';
import ImportDetailsModal from '../components/ImportDetailsModal';
import ImportWizard from '../components/ImportWizard';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import SmartRestoreModal from '../components/SmartRestoreModal';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, ShowMore } from '../components/ui/Display';
import { ConfirmDialog, Dialog } from '../components/ui/Overlays';
import { EmptyState } from '../components/ui/States';
import { arrayToCSV, downloadCSV, toLocalISOString } from '../utils';
import { applyRestore, buildCsvExports, buildJsonExport, ExportConfig, RestoreStrategy } from '../utils/dataTransfer';

interface DataImportExportProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  allCategories: Category[];
  history: ImportExportHistoryItem[];
  onPublishImport: (items: any[], dataType: 'accounts' | 'transactions', fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccounts?: Account[]) => void;
  onDeleteHistoryItem: (id: string) => void;
  onDeleteImportedTransactions: (importId: string) => void;
  onResetAccount: () => void;
  setCurrentPage: (page: Page) => void;
  onRestoreData: (data: FinancialData) => void;
  onLogExport?: (dataType: ImportDataType, format: 'csv' | 'json', itemCount: number) => void;
  fullFinancialData: FinancialData; 
}

const STATUS_TONE: Record<HistoryStatus, 'positive' | 'negative' | 'blue'> = { Complete: 'positive', Failed: 'negative', 'In Progress': 'blue' };
const TYPE_LABEL = { import: 'Import', export: 'Export', restore: 'Restore' };
const HISTORY_PAGE = 10;

const IMPORT_SOURCES: { type: 'transactions' | 'accounts'; title: string; description: string; icon: string }[] = [
  { type: 'transactions', title: 'Transactions', description: 'From a bank statement or spreadsheet', icon: 'receipt_long' },
  { type: 'accounts', title: 'Accounts', description: 'From a spreadsheet', icon: 'wallet' },
];

const downloadJson = (data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `crystal-export-${toLocalISOString(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ActionRow: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 flex-1 basis-56">
      <p className="type-body-strong text-ink">{title}</p>
      <p className="type-caption mt-0.5 text-muted">{description}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const DataImportExportPage: React.FC<DataImportExportProps> = props => {
  const [isChoosingImport, setChoosingImport] = useState(false);
  const [importType, setImportType] = useState<'transactions' | 'accounts' | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | null>(null);
  const [isRestoring, setRestoring] = useState(false);
  const [viewing, setViewing] = useState<ImportExportHistoryItem | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [visibleHistory, setVisibleHistory] = useState(HISTORY_PAGE);

  const history = useMemo(() => [...props.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [props.history]);
  const countOf = (type: ImportExportHistoryItem['type']) => history.filter(item => item.type === type).length;

  const runExport = (config: ExportConfig) => {
    const source = {
      accounts: props.accounts,
      transactions: props.transactions,
      budgets: props.budgets,
      recurringTransactions: props.recurringTransactions,
      allCategories: props.allCategories,
      fullFinancialData: props.fullFinancialData,
    };
    if (config.format === 'json') {
      const data = buildJsonExport(config, source);
      props.onLogExport?.('snapshot', 'json', Object.keys(data).length);
      downloadJson(data);
      return;
    }
    const tables = buildCsvExports(config, source);
    if (tables.length === 0) toast.info('There’s nothing to export for that choice.');
    tables.forEach(({ type, rows }) => {
      props.onLogExport?.(type as ImportDataType, 'csv', rows.length);
      downloadCSV(arrayToCSV(rows), `crystal-${type}.csv`);
    });
  };

  const restore = (data: FinancialData, strategy: Record<string, RestoreStrategy>) => {
    props.onRestoreData(applyRestore(props.fullFinancialData, data, strategy));
    toast.success('Backup restored');
  };

  return (
    <div className="space-y-8">
      <SettingsSubpageHeader
        title="Data"
        setCurrentPage={props.setCurrentPage}
        stats={[
          { label: 'Imports', icon: 'download', value: countOf('import') },
          { label: 'Exports', icon: 'upload', value: countOf('export') },
          { label: 'Restores', icon: 'refresh', value: countOf('restore') },
        ]}
      />

      <Dialog isOpen={isChoosingImport} onClose={() => setChoosingImport(false)} title="Import from CSV">
        <div className="space-y-2">
          {IMPORT_SOURCES.map(source => (
            <button
              key={source.type}
              type="button"
              onClick={() => { setChoosingImport(false); setImportType(source.type); }}
              className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line p-3 text-left outline-none transition-colors hover:bg-inset focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="min-w-0">
                <span className="type-body-strong block text-ink">{source.title}</span>
                <span className="type-caption block text-muted">{source.description}</span>
              </span>
            </button>
          ))}
        </div>
      </Dialog>
      {exportFormat && <ExportModal onClose={() => setExportFormat(null)} onExport={runExport} accounts={props.accounts} initialFormat={exportFormat} />}
      {isRestoring && <SmartRestoreModal onClose={() => setRestoring(false)} onRestore={restore} currentData={props.fullFinancialData} />}
      {viewing && <ImportDetailsModal item={viewing} onClose={() => setViewing(null)} onDeleteImport={props.onDeleteImportedTransactions} />}
      {importType && (
        <ImportWizard
          importType={importType}
          onClose={() => setImportType(null)}
          onPublish={props.onPublishImport}
          existingAccounts={props.accounts}
          allCategories={props.allCategories}
        />
      )}
      <ConfirmDialog
        isOpen={resetStep === 1}
        onClose={() => setResetStep(0)}
        onConfirm={() => setResetStep(2)}
        title="Erase all data?"
        message="This deletes all your data. You can’t undo this, so download a backup first."
        confirmLabel="Continue"
        isDestructive
      />
      <ConfirmDialog
        isOpen={resetStep === 2}
        onClose={() => setResetStep(0)}
        onConfirm={() => { props.onResetAccount(); setResetStep(0); }}
        title="Last check"
        message="Everything goes as soon as you confirm."
        confirmLabel="Erase all data"
        requireText="RESET"
        isDestructive
      />

      <SettingsGroup title="Import and export" description="Move data in and out as spreadsheets.">
        <div className="divide-y divide-line">
          <ActionRow title="Import" description="Bring in transactions or accounts from a CSV file.">
            <Button variant="secondary" size="sm" icon="upload_file" onPress={() => setChoosingImport(true)}>Import</Button>
          </ActionRow>
          <ActionRow title="Export" description="Download your data as CSV tables.">
            <Button variant="secondary" size="sm" icon="download" onPress={() => setExportFormat('csv')}>Export</Button>
          </ActionRow>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Backups" description="A full copy of Crystal in one file.">
        <div className="divide-y divide-line">
          <ActionRow title="Back up" description="Download everything as a JSON file.">
            <Button variant="secondary" size="sm" icon="download" onPress={() => setExportFormat('json')}>Back up</Button>
          </ActionRow>
          <ActionRow title="Restore" description="Merge or replace data from a backup, section by section.">
            <Button variant="secondary" size="sm" icon="restore" onPress={() => setRestoring(true)}>Restore</Button>
          </ActionRow>
        </div>
      </SettingsGroup>

      <SettingsGroup title="History">
        {history.length === 0 ? (
          <EmptyState icon="history" title="No activity yet" description="Imports, exports and restores appear here." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {history.slice(0, visibleHistory).map(item => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 first:pt-0">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="type-body truncate text-ink">{item.fileName}</p>
                    <p className="type-caption truncate text-muted">
                      {TYPE_LABEL[item.type]} · {new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}{item.details ? ` · ${item.details}` : ''}
                    </p>
                  </div>
                  {item.type === 'import' && item.status === 'Failed' && item.itemCount > 0
                    ? <Badge tone="attention">Partly imported</Badge>
                    : <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>}
                  <div className="flex items-center">
                    {item.type === 'import' && <IconButton icon="visibility" label={`Open ${item.fileName}`} onPress={() => setViewing(item)} />}
                    <IconButton icon="delete" label={`Remove ${item.fileName} from history`} onPress={() => props.onDeleteHistoryItem(item.id)} />
                  </div>
                </li>
              ))}
            </ul>
            {history.length > visibleHistory && <ShowMore remaining={history.length - visibleHistory} onPress={() => setVisibleHistory(count => count + HISTORY_PAGE)} className="mt-3" />}
          </>
        )}
      </SettingsGroup>

      <SettingsGroup id="data-erase" title="Erase all data">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body min-w-0 flex-1 basis-56 text-muted">Delete every account, transaction and setting. You can’t undo this without a backup.</p>
          <Button variant="destructive" size="sm" onPress={() => setResetStep(1)}>Erase all data</Button>
        </div>
      </SettingsGroup>
    </div>
  );
};

export default DataImportExportPage;
