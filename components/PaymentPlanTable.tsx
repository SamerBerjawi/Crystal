
import React, { useState, useMemo, useEffect } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { generateAmortizationSchedule, formatCurrency, parseDateAsUTC } from '../utils';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface PaymentPlanTableProps {
  account: Account;
  transactions: Transaction[];
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  overrides: Record<number, Partial<ScheduledPayment>>;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
}

const PaymentPlanTable: React.FC<PaymentPlanTableProps> = ({ account, transactions, onMakePayment, overrides, onOverridesChange }) => {
    const [editingPaymentNumber, setEditingPaymentNumber] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Pick<ScheduledPayment, 'totalPayment' | 'principal' | 'interest'>>>({});
    const [lastEditedField, setLastEditedField] = useState<'total' | 'principal' | 'interest' | null>(null);

    const schedule = useMemo(() => {
        return generateAmortizationSchedule(account, transactions, overrides);
    }, [account, transactions, overrides]);

    const totals = useMemo(() => {
        return schedule.reduce((acc, payment) => {
            acc.totalPayment += payment.totalPayment;
            acc.principal += payment.principal;
            acc.interest += payment.interest;
            return acc;
        }, { totalPayment: 0, principal: 0, interest: 0 });
    }, [schedule]);

    const handleEditClick = (payment: ScheduledPayment) => {
        setEditingPaymentNumber(payment.paymentNumber);
        setEditFormData({
            totalPayment: payment.totalPayment,
            principal: payment.principal,
            interest: payment.interest,
        });
        setLastEditedField(null);
    };

    const handleCancelEdit = () => {
        setEditingPaymentNumber(null);
        setEditFormData({});
    };

    const handleSaveEdit = () => {
        if (editingPaymentNumber === null) return;
        onOverridesChange({ ...overrides, [editingPaymentNumber]: editFormData });
        handleCancelEdit();
    };

    useEffect(() => {
        const total = editFormData.totalPayment;
        const principal = editFormData.principal;
        const interest = editFormData.interest;

        if (lastEditedField === 'total') {
            if (total !== undefined && interest !== undefined) {
                const newPrincipal = total - interest;
                setEditFormData(prev => ({ ...prev, principal: parseFloat(newPrincipal.toFixed(2)) }));
            }
        } else if (lastEditedField === 'principal' || lastEditedField === 'interest') {
            if (principal !== undefined && interest !== undefined) {
                const newTotal = principal + interest;
                setEditFormData(prev => ({ ...prev, totalPayment: parseFloat(newTotal.toFixed(2)) }));
            }
        }
    }, [editFormData.totalPayment, editFormData.principal, editFormData.interest, lastEditedField]);

    const handleEditFormChange = (field: 'totalPayment' | 'principal' | 'interest', value: string) => {
        setLastEditedField(field === 'totalPayment' ? 'total' : field);
        setEditFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    if (schedule.length === 0) {
        return <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-4">A payment plan can be generated once a principal, interest rate, duration, and start date are set for this account.</p>;
    }

    const isLending = account.type === 'Lending';

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="border-b border-black/10 dark:border-white/10">
                    <tr>
                        <th className="p-2 font-semibold">#</th>
                        <th className="p-2 font-semibold">Date</th>
                        <th className="p-2 font-semibold text-right">Total Payment</th>
                        <th className="p-2 font-semibold text-right">Principal</th>
                        <th className="p-2 font-semibold text-right">Interest</th>
                        <th className="p-2 font-semibold text-right">Balance</th>
                        <th className="p-2 font-semibold text-center">Status</th>
                        <th className="p-2 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.map(payment => {
                        const isEditing = editingPaymentNumber === payment.paymentNumber;
                        return (
                        <tr key={payment.paymentNumber} className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${isEditing ? 'bg-primary-500/10' : ''}`}>
                            <td className="p-2 font-medium">{payment.paymentNumber}</td>
                            <td className="p-2">{parseDateAsUTC(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                            
                            {isEditing ? (
                                <>
                                    <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.totalPayment} onChange={e => handleEditFormChange('totalPayment', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                    <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.principal} onChange={e => handleEditFormChange('principal', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                    <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.interest} onChange={e => handleEditFormChange('interest', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                </>
                            ) : (
                                <>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(payment.totalPayment, account.currency)}</td>
                                    <td className="p-2 text-right">{formatCurrency(payment.principal, account.currency)}</td>
                                    <td className="p-2 text-right text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(payment.interest, account.currency)}</td>
                                </>
                            )}
                            
                            <td className="p-2 text-right text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(payment.outstandingBalance, account.currency)}</td>
                            <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    payment.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                                    payment.status === 'Overdue' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                                    'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300'
                                }`}>{payment.status}</span>
                            </td>
                            <td className="p-2 text-right">
                                {isEditing ? (
                                    <div className="flex justify-end gap-2">
                                        <button onClick={handleSaveEdit} className="p-1"><span className="material-symbols-outlined text-green-500">check</span></button>
                                        <button onClick={handleCancelEdit} className="p-1"><span className="material-symbols-outlined text-red-500">close</span></button>
                                    </div>
                                ) : payment.status !== 'Paid' ? (
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onMakePayment(payment, `Payment #${payment.paymentNumber} for ${account.name}`)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 !text-xs`}>
                                            {isLending ? 'Receive' : 'Pay'}
                                        </button>
                                        <button onClick={() => handleEditClick(payment)} className={`${BTN_SECONDARY_STYLE} !py-1 !px-3 !text-xs`} title="Edit Payment">
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                    </div>
                                ) : null}
                            </td>
                        </tr>
                    )})}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-black/20 dark:border-white/20 font-bold bg-light-bg dark:bg-dark-bg">
                        <td className="p-2" colSpan={2}>Totals</td>
                        <td className="p-2 text-right">{formatCurrency(totals.totalPayment, account.currency)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.principal, account.currency)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.interest, account.currency)}</td>
                        <td className="p-2" colSpan={3}></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default PaymentPlanTable;