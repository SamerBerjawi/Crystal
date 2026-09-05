import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MileageLog } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { toLocalISOString, parseLocalDate } from '../utils';
import Icon from './ui/Icon';

interface AddMileageLogModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave: (log: Omit<MileageLog, 'id'> & { id?: string }) => void;
  onBatchSave?: (logs: Array<Omit<MileageLog, 'id'> & { id?: string }>) => void;
  logToEdit?: MileageLog | null;
  existingLogs?: MileageLog[];
}

export interface ParsedBatchMileageEntry {
  date: string;
  reading: number;
  notes?: string;
  diff?: number;
  error?: string;
  warning?: string;
}

const AddMileageLogModal: React.FC<AddMileageLogModalProps> = ({
  isOpen = true,
  onClose,
  onSave,
  onBatchSave,
  logToEdit,
  existingLogs = []
}) => {
  const isEditing = !!logToEdit;
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  
  // Single entry state
  const [date, setDate] = useState(toLocalISOString(new Date()));
  const [reading, setReading] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Bulk entry state
  const [bulkData, setBulkData] = useState('');

  useEffect(() => {
    if (logToEdit) {
      setDate(logToEdit.date);
      setReading(String(logToEdit.reading));
      setMode('single');
    } else {
      setDate(toLocalISOString(new Date()));
      setReading('');
    }

    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, [logToEdit]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (date && reading !== '') {
      const parsedReading = parseInt(reading.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedReading)) {
        onSave({ id: logToEdit?.id, date, reading: parsedReading });
        handleClose();
      }
    }
  };

  // Bulk CSV/TSV parser
  const parsedBulkEntries = useMemo(() => {
    if (!bulkData.trim()) return [];

    const lines = bulkData.split('\n');
    const entries: ParsedBatchMileageEntry[] = [];

    // Combine existing logs sorted by date to calculate deltas
    const sortedExisting = [...existingLogs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Match delimiters: comma, semicolon, tab, or whitespace
      // Sample formats:
      // "2024-05-10, 45000"
      // "2024-05-10, 45000, Oil change service"
      // "2024-05-10 45000"
      // "2024-05-10\t45000"
      let parts: string[] = [];
      if (trimmed.includes(',')) {
        parts = trimmed.split(',').map(s => s.trim());
      } else if (trimmed.includes(';')) {
        parts = trimmed.split(';').map(s => s.trim());
      } else if (trimmed.includes('\t')) {
        parts = trimmed.split('\t').map(s => s.trim());
      } else {
        parts = trimmed.split(/\s+/).map(s => s.trim());
      }

      if (parts.length < 2) {
        entries.push({
          date: '',
          reading: 0,
          error: `Line ${idx + 1}: requires a date (YYYY-MM-DD) and an odometer reading.`
        });
        return;
      }

      const rawDate = parts[0];
      const rawReading = parts[1];
      const notes = parts.slice(2).join(' ') || undefined;

      // Validate date
      const dateObj = new Date(rawDate);
      if (isNaN(dateObj.getTime()) || !rawDate.match(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/)) {
        entries.push({
          date: rawDate,
          reading: 0,
          error: `Line ${idx + 1}: invalid date format "${rawDate}". Use YYYY-MM-DD.`
        });
        return;
      }

      // Normalize date to YYYY-MM-DD
      const normalizedDate = toLocalISOString(dateObj);

      // Validate reading
      const cleanedReading = rawReading.replace(/[^0-9]/g, '');
      const parsedReading = parseInt(cleanedReading, 10);
      if (isNaN(parsedReading) || parsedReading < 0) {
        entries.push({
          date: normalizedDate,
          reading: 0,
          error: `Line ${idx + 1}: invalid odometer reading "${rawReading}".`
        });
        return;
      }

      entries.push({
        date: normalizedDate,
        reading: parsedReading,
        notes,
      });
    });

    // Sort valid entries chronologically
    const validEntries = entries.filter(e => !e.error).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate distance deltas and sanity check against previous reading
    for (let i = 0; i < validEntries.length; i++) {
      const current = validEntries[i];
      let prevReading: number | null = null;

      if (i > 0) {
        prevReading = validEntries[i - 1].reading;
      } else {
        // Look in existing vehicle logs prior to this date
        const priorLogs = sortedExisting.filter(e => e.date <= current.date);
        if (priorLogs.length > 0) {
          prevReading = priorLogs[priorLogs.length - 1].reading;
        }
      }

      if (prevReading !== null) {
        current.diff = current.reading - prevReading;
        if (current.diff < 0) {
          current.warning = `Reading is lower than previous record (${prevReading.toLocaleString()} km).`;
        }
      }
    }

    return entries;
  }, [bulkData, existingLogs]);

  const validBulkEntries = useMemo(() => parsedBulkEntries.filter(e => !e.error), [parsedBulkEntries]);
  const hasBulkErrors = useMemo(() => parsedBulkEntries.some(e => !!e.error), [parsedBulkEntries]);

  const handleApplyBulk = () => {
    if (validBulkEntries.length === 0 || hasBulkErrors) return;

    if (onBatchSave) {
      onBatchSave(validBulkEntries.map(e => ({ date: e.date, reading: e.reading })));
    } else {
      validBulkEntries.forEach(e => {
        onSave({ date: e.date, reading: e.reading });
      });
    }
    handleClose();
  };

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div 
          className={`w-screen max-w-lg bg-white dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-teal-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 shadow-xs">
                <Icon name="speed" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                  {isEditing ? 'Edit Mileage Entry' : 'Log Vehicle Mileage'}
                </h2>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Track odometer readings and service milestones
                </p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          {/* Mode Switcher Tabs (Only if not editing existing log) */}
          {!isEditing && (
            <div className="px-6 pt-5 pb-1">
              <div className="flex bg-slate-100 dark:bg-dark-fill/50 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    mode === 'single'
                      ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="add" className="text-sm" />
                  <span>Single Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('bulk')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    mode === 'bulk'
                      ? 'bg-white dark:bg-dark-card text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="file_upload" className="text-sm" />
                  <span>Batch Import (CSV)</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">

              {mode === 'single' ? (
                /* SINGLE ENTRY FORM */
                <form id="single-mileage-form" onSubmit={handleSubmitSingle} className="space-y-6">
                  {/* Reading Card */}
                  <div className="p-6 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="reading" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Odometer Reading (km) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group">
                        <input
                          id="reading"
                          type="number"
                          value={reading}
                          onChange={(e) => setReading(e.target.value)}
                          className={`${INPUT_BASE_STYLE} pr-14 h-14 !text-2xl font-bold tabular-nums`}
                          placeholder="e.g. 45000"
                          required
                          autoFocus
                          min="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                          KM
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Logged Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`${INPUT_BASE_STYLE} h-12`}
                        required
                      />
                    </div>
                  </div>
                </form>
              ) : (
                /* BATCH IMPORT CSV/TSV FORM */
                <div className="space-y-5">
                  {/* Instructions Card */}
                  <div className="p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                        <Icon name="description" className="text-teal-500 text-base" />
                        <span>CSV / TSV Batch Input</span>
                      </h4>
                      <span className="text-2xs font-bold text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full bg-teal-500/10 uppercase tracking-wider">
                        YYYY-MM-DD READING
                      </span>
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                      Paste multiple entries separated by commas, semicolons, tabs, or spaces. One record per line.
                    </p>
                    <textarea
                      id="bulk-mileage-data"
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      className={`${INPUT_BASE_STYLE} font-mono !text-xs h-48 p-4 leading-relaxed bg-white dark:bg-black/20 border-black/5 dark:border-white/5`}
                      placeholder={`2024-01-15, 45000\n2024-04-10, 48500\n2024-07-22, 52100\n2024-11-05, 56300`}
                      autoFocus
                    />
                  </div>

                  {/* Live Validation & Preview */}
                  {validBulkEntries.length > 0 && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="p-4 bg-teal-500/10 rounded-2xl border border-teal-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center">
                            <Icon name="task_alt" className="text-teal-600 dark:text-teal-400 text-sm" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                            {validBulkEntries.length} Records Validated
                          </span>
                        </div>
                        <span className="text-2xs font-medium text-teal-700 dark:text-teal-400 font-mono">
                          Max: {Math.max(...validBulkEntries.map(e => e.reading)).toLocaleString()} km
                        </span>
                      </div>

                      {/* Entries Preview List */}
                      <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 max-h-56 overflow-y-auto space-y-2 no-scrollbar">
                        {parsedBulkEntries.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl flex items-center justify-between text-xs border ${
                              entry.error
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                                : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5'
                            }`}
                          >
                            {entry.error ? (
                              <div className="flex items-center gap-2">
                                <Icon name="error" className="text-sm shrink-0" />
                                <span className="font-medium">{entry.error}</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-2xs opacity-50">#{idx + 1}</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {parseLocalDate(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                  {entry.warning && (
                                    <span className="text-2xs text-amber-600 dark:text-amber-400" title={entry.warning}>
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {entry.diff !== undefined && entry.diff > 0 && (
                                    <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                      +{entry.diff.toLocaleString()} km
                                    </span>
                                  )}
                                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                                    {entry.reading.toLocaleString()} km
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasBulkErrors && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <Icon name="error" className="text-base shrink-0" />
                      <span>Please fix any invalid lines before importing.</span>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button 
                type="button" 
                onClick={handleClose} 
                className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
              >
                Cancel
              </button>

              {mode === 'single' ? (
                <button 
                  type="submit"
                  form="single-mileage-form"
                  className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95`}
                >
                  <span>{isEditing ? 'Save Changes' : 'Record Mileage'}</span>
                  <Icon name="check" className="text-base" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  disabled={validBulkEntries.length === 0 || hasBulkErrors}
                  className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
                >
                  <Icon name="upload" className="text-base" />
                  <span>Import {validBulkEntries.length} Readings</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AddMileageLogModal;