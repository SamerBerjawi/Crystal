import React, { useMemo, useState } from 'react';
import { MileageLog } from '../types';
import { parseLocalDate, toLocalISOString } from '../utils';
import { parseMileageBatch, parseReading, readingProblem } from '../utils/mileageModel';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { DateInput, Textarea, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';

const MODES = [
  { id: 'single', label: 'One reading' },
  { id: 'batch', label: 'Paste several' },
];

interface AddMileageLogModalProps {
  onClose: () => void;
  onSave: (log: Omit<MileageLog, 'id'> & { id?: string }) => void;
  onBatchSave?: (logs: Array<Omit<MileageLog, 'id'> & { id?: string }>) => void;
  logToEdit?: MileageLog | null;
  existingLogs?: MileageLog[];
}

const AddMileageLogModal: React.FC<AddMileageLogModalProps> = ({ onClose, onSave, onBatchSave, logToEdit, existingLogs = [] }) => {
  const [mode, setMode] = useState('single');
  const [date, setDate] = useState(logToEdit?.date ?? toLocalISOString(new Date()));
  const [reading, setReading] = useState(logToEdit ? String(logToEdit.reading) : '');
  const [readingError, setReadingError] = useState<string | null>(null);
  const [batchText, setBatchText] = useState('');

  const entries = useMemo(() => parseMileageBatch(batchText, existingLogs), [batchText, existingLogs]);
  const valid = entries.filter(entry => !entry.error);
  const hasErrors = valid.length < entries.length;
  const isSingle = mode === 'single';

  const saveSingle = () => {
    const parsed = parseReading(reading);
    const problem = readingProblem(parsed, date, existingLogs, logToEdit?.id);
    if (problem) {
      setReadingError(problem);
      return;
    }
    onSave({ id: logToEdit?.id, date, reading: parsed });
    onClose();
  };

  const saveBatch = () => {
    const logs = valid.map(entry => ({ date: entry.date, reading: entry.reading }));
    if (onBatchSave) onBatchSave(logs);
    else logs.forEach(onSave);
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={logToEdit ? 'Edit reading' : 'Add reading'}
      isDirty={isSingle ? reading !== (logToEdit ? String(logToEdit.reading) : '') : !!batchText}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          {isSingle
            ? <Button isDisabled={!date || Number.isNaN(parseReading(reading))} onPress={saveSingle}>{logToEdit ? 'Save reading' : 'Add reading'}</Button>
            : <Button isDisabled={valid.length === 0 || hasErrors} onPress={saveBatch}>Add {valid.length || ''} {valid.length === 1 ? 'reading' : 'readings'}</Button>}
        </div>
      )}
    >
      <div className="space-y-4">
        {!logToEdit && <SegmentedControl items={MODES} activeId={mode} onChange={setMode} />}
        {isSingle ? (
          <>
            <TextInput autoFocus label="Odometer (km)" inputMode="numeric" placeholder="45000" value={reading} onChange={text => { setReading(text); setReadingError(null); }} error={readingError ?? undefined} />
            <DateInput label="Date" value={date} onChange={value => { setDate(value); setReadingError(null); }} isRequired />
          </>
        ) : (
          <>
            <Textarea
              autoFocus
              label="Readings"
              help="One per line: date, then reading. Commas, semicolons, tabs or spaces all work."
              rows={7}
              placeholder={'2024-01-15, 45000\n2024-04-10, 48500'}
              value={batchText}
              onChange={setBatchText}
            />
            {entries.length > 0 && (
              <ul className="divide-y divide-line">
                {entries.map((entry, index) => (
                  <li key={index} className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 py-1.5">
                    {entry.error ? <span className="type-caption text-money-out">{entry.error}</span> : (
                      <>
                        <span className="type-body text-ink">{parseLocalDate(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                        <span className="type-body-strong tabular-nums text-ink">{entry.reading.toLocaleString()} km{entry.diff !== undefined && entry.diff > 0 ? <span className="type-caption text-muted"> +{entry.diff.toLocaleString()}</span> : null}</span>
                        {entry.warning && <Badge tone="attention" className="basis-full whitespace-normal">{entry.warning}</Badge>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
};

export default AddMileageLogModal;
