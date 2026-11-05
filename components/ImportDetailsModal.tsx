import React, { useState } from 'react';
import { ImportExportHistoryItem } from '../types';
import { Button } from './ui/Actions';
import { ConfirmDialog, SidePanel } from './ui/Overlays';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';
import { EmptyState } from './ui/States';

interface ImportDetailsModalProps {
  item: ImportExportHistoryItem;
  onClose: () => void;
  onDeleteImport: (importId: string) => void;
}

const FIRST_DATA_ROW = 2;

const cellStyles = 'whitespace-nowrap px-3 py-2 text-left';

const DataTable: React.FC<{ headers: string[]; rows: Record<string, any>[]; lead?: { title: string; cells: React.ReactNode[] }[] }> = ({ headers, rows, lead = [] }) => (
  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
    <table className="type-caption min-w-full text-ink">
      <thead className="bg-inset text-muted">
        <tr>
          {lead.map(column => <th key={column.title} className={cellStyles}>{column.title}</th>)}
          {headers.map(header => <th key={header} className={cellStyles}>{header}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row, index) => (
          <tr key={index}>
            {lead.map(column => <td key={column.title} className={cellStyles}>{column.cells[index]}</td>)}
            {headers.map(header => <td key={header} className={cellStyles}>{String(row[header] ?? '')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ImportDetailsModal: React.FC<ImportDetailsModalProps> = ({ item, onClose, onDeleteImport }) => {
  const [isOpen, setOpen] = useState(true);
  const [tab, setTab] = useState<'imported' | 'errors'>('imported');
  const [isConfirming, setConfirming] = useState(false);

  const imported = item.importedData?.filter((_, index) => !item.errors?.[index]) ?? [];
  const errors = Object.entries(item.errors ?? {}).map(([index, error]) => ({
    row: parseInt(index, 10) + FIRST_DATA_ROW,
    data: item.importedData?.[parseInt(index, 10)] ?? {},
    message: Object.values(error).join(', '),
  }));
  const headers = item.importedData?.length ? Object.keys(item.importedData[0]) : [];
  const canUndo = item.dataType === 'transactions' && item.itemCount > 0;

  const close = () => { setOpen(false); onClose(); };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      width={640}
      title={item.fileName}
      description={`${new Date(item.date).toLocaleDateString()} · ${item.itemCount} imported · ${errors.length} with errors`}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          {canUndo && <Button variant="destructive" className="md:mr-auto" onPress={() => setConfirming(true)}>Delete this import</Button>}
          <Button variant="ghost" onPress={close}>Close</Button>
        </div>
      }
    >
      <SmoothTab
        fullWidth
        className="mb-4 w-full"
        items={[
          { id: 'imported', title: `Valid rows (${imported.length})` },
          {
            id: 'errors',
            title: `Errors (${errors.length})`,
            activeColor: errors.length > 0 ? 'bg-money-out' : undefined,
            activeTextColor: errors.length > 0 ? 'text-on-danger' : undefined,
          },
        ]}
        value={tab}
        onChange={id => setTab(id as 'imported' | 'errors')}
        label="Import details rows"
      />
      {tab === 'imported' && (imported.length > 0
        ? <DataTable headers={headers} rows={imported} />
        : <EmptyState icon="table-01" title="No valid rows" description="Every row in this file had a problem." />)}
      {tab === 'errors' && (errors.length > 0
        ? <DataTable headers={headers} rows={errors.map(error => error.data)} lead={[
            { title: 'Row', cells: errors.map(error => error.row) },
            { title: 'Problem', cells: errors.map(error => error.message) },
          ]} />
        : <EmptyState icon="checkmark-circle-02" title="No errors" description="Every row imported cleanly." />)}

      <ConfirmDialog
        isOpen={isConfirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => { onDeleteImport(item.id); setConfirming(false); close(); }}
        title="Delete this import?"
        message={`This removes the ${item.itemCount} imported transactions. You can’t undo this.`}
        confirmLabel="Delete import"
        isDestructive
      />
    </SidePanel>
  );
};

export default ImportDetailsModal;
