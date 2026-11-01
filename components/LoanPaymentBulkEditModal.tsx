import React, { useMemo, useState } from 'react';
import { Button } from './ui/Actions';
import { Textarea } from './ui/Fields';
import { Dialog } from './ui/Overlays';

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
    <Dialog
      isOpen
      onClose={onClose}
      title="Bulk edit payments"
      description="One payment per line: number, total, principal, interest. Spaces, commas or tabs all work."
      isDirty={!!bulkData}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={hasErrors || validEntries.length === 0} onPress={handleApply}>Apply {validEntries.length || ''}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <Textarea label="Payments" rows={6} placeholder="12 2156.68 1302.77 853.91" value={bulkData} onChange={setBulkData} />
        {parsedEntries.length > 0 && (
          <ul className="divide-y divide-line">
            {parsedEntries.map((entry, index) => (
              <li key={`${entry.paymentNumber}-${index}`} className="type-caption py-1.5 tabular-nums">
                {entry.error
                  ? <span className="text-money-out">{entry.error}</span>
                  : <span className="text-ink">Payment {entry.paymentNumber}: total {entry.totalPayment?.toFixed(2) ?? '—'}, principal {entry.principal?.toFixed(2) ?? '—'}, interest {entry.interest?.toFixed(2) ?? '—'}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
};

export default LoanPaymentBulkEditModal;
