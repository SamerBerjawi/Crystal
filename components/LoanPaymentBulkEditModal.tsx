import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';

interface LoanPaymentBulkEditModalProps {
  scheduleLength: number;
  onClose: () => void;
  onApply: (entries: BulkPaymentEntry[]) => void;
}

export interface BulkPaymentEntry {
  paymentNumber: number;
  totalPayment?: number;
  principal?: number;
  interest?: number;
  error?: string;
}

const LoanPaymentBulkEditModal: React.FC<LoanPaymentBulkEditModalProps> = ({ scheduleLength, onClose, onApply }) => {
  const [bulkData, setBulkData] = useState('');

  const normalizeDecimalString = (rawValue: string): string => {
    const cleaned = rawValue
      .replace(/\s+/g, '')
      .replace(/\u00A0/g, '')
      .replace(/[^0-9.,-]/g, '');

    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : (lastComma > lastDot ? ',' : null);

    if (decimalSeparator) {
      const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
      const withoutThousands = cleaned.split(thousandsSeparator).join('');
      return withoutThousands.replace(decimalSeparator, '.');
    }

    return cleaned.replace(/,/g, '.');
  };

  const parsedEntries = useMemo(() => {
    const lines = bulkData.split('\n');
    const entries: BulkPaymentEntry[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 2) {
        entries.push({ paymentNumber: 0, error: `Line ${index + 1}: add a payment number and at least one amount.` });
        return;
      }

      const paymentNumber = parseInt(parts[0], 10);
      if (Number.isNaN(paymentNumber) || paymentNumber <= 0) {
        entries.push({ paymentNumber: 0, error: `Line ${index + 1}: invalid payment number.` });
        return;
      }

      const rawAmounts = parts.slice(1, 4).map(normalizeDecimalString);
      const amounts = rawAmounts.map(value => parseFloat(value));
      if (amounts.some(value => Number.isNaN(value))) {
        entries.push({ paymentNumber, error: `Line ${index + 1}: invalid amount value.` });
        return;
      }

      if (paymentNumber > scheduleLength) {
        entries.push({ paymentNumber, error: `Line ${index + 1}: payment # exceeds schedule length (${scheduleLength}).` });
        return;
      }

      let totalPayment: number | undefined;
      let principal: number | undefined;
      let interest: number | undefined;

      if (amounts.length === 3) {
        [totalPayment, principal, interest] = amounts;
      } else if (amounts.length === 2) {
        [principal, interest] = amounts;
        totalPayment = principal + interest;
      } else if (amounts.length === 1) {
        [totalPayment] = amounts;
      }

      entries.push({
        paymentNumber,
        totalPayment,
        principal,
        interest,
      });
    });

    return entries;
  }, [bulkData, scheduleLength]);

  const hasErrors = parsedEntries.some(entry => entry.error);
  const validEntries = parsedEntries.filter(entry => !entry.error);

  const handleApply = () => {
    if (hasErrors || validEntries.length === 0) {
      return;
    }
    onApply(validEntries);
  };

  return (
    <Modal title="Bulk Edit Loan Payments" onClose={onClose} size="2xl">
      <div className="space-y-4">
        <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary space-y-2">
          <p>Paste one payment per line using any separator (comma, space, tab).</p>
          <p className="font-medium">Format: <span className="font-mono">paymentNumber total principal interest</span></p>
          <p className="text-xs">Example: <span className="font-mono">12 2156.68 1302.77 853.91</span></p>
        </div>

        <textarea
          value={bulkData}
          onChange={e => setBulkData(e.target.value)}
          className={`${INPUT_BASE_STYLE} !h-40 font-mono`}
          placeholder="1 2156.68 1302.77 853.91"
        />

        <div className="bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5 rounded-2xl p-4 text-sm">
          {parsedEntries.length === 0 ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs font-medium">Paste values to preview changes.</p>
          ) : (
            <div className="space-y-2">
              {parsedEntries.map((entry, index) => (
                <div key={`${entry.paymentNumber}-${index}`} className="flex items-center justify-between gap-4">
                  <div className="font-mono text-xs">
                    {entry.error ? (
                      <span className="text-rose-500 font-bold">{entry.error}</span>
                    ) : (
                      <>
                        <span className="text-light-text-secondary dark:text-dark-text-secondary font-bold">#{entry.paymentNumber}</span>
                        <span className="ml-3 font-semibold">Total {entry.totalPayment?.toFixed(2) ?? '—'}</span>
                        <span className="ml-3 text-light-text-secondary dark:text-dark-text-secondary">Principal {entry.principal?.toFixed(2) ?? '—'}</span>
                        <span className="ml-3 text-light-text-secondary dark:text-dark-text-secondary">Interest {entry.interest?.toFixed(2) ?? '—'}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider`}>Cancel</button>
          <button onClick={handleApply} className={`${BTN_PRIMARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`} disabled={hasErrors || validEntries.length === 0}>
            Apply Overrides
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LoanPaymentBulkEditModal;
