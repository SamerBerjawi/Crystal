
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
        return (
            <div className="text-center text-light-text-secondary dark:text-dark-text-secondary py-12 bg-light-bg dark:bg-dark-bg rounded-lg border border-dashed border-light-separator dark:border-dark-separator">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">pending_actions</span>
                <p>To generate a payment plan, please edit the account and set the Principal, Interest Rate, Duration, and Start Date.</p>
            </div>
        );
    }

    const isLending = account.type === 'Lending';

    return (
        <div className="flex flex-col h-[600px]">
            <div className="flex-grow overflow-auto border border-black/5 dark:border-white/10 rounded-lg bg-light-bg dark:bg-dark-bg scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                <table className="w-full text-sm text-left relative border-collapse">
                    <thead className="text-xs uppercase bg-light-fill dark:bg-dark-fill text-light-text-secondary dark:text-dark-text-secondary font-semibold sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="p-3 whitespace-nowrap border-b border-black/5 dark:border-white/5">#</th>
                            <th className="p-3 whitespace-nowrap border-b border-black/5 dark:border-white/5">Date</th>
                            <th className="p-3 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Total</th>
                            <th className="p-3 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Principal</th>
                            <th className="p-3 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Interest</th>
                            <th className="p-3 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Balance</th>
                            <th className="p-3 whitespace-nowrap text-center border-b border-black/5 dark:border-white/5">Status</th>
                            <th className="p-3 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {schedule.map(payment => {
                            const isEditing = editingPaymentNumber === payment.paymentNumber;
                            return (
                            <tr key={payment.paymentNumber} className={`group hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isEditing ? 'bg-primary-500/10' : ''}`}>
                                <td className="p-3 font-mono text-xs opacity-70">{payment.paymentNumber}</td>
                                <td className="p-3">{parseDateAsUTC(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                                
                                {isEditing ? (
                                    <>
                                        <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.totalPayment} onChange={e => handleEditFormChange('totalPayment', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                        <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.principal} onChange={e => handleEditFormChange('principal', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                        <td className="p-1 text-right"><input type="number" step="0.01" value={editFormData.interest} onChange={e => handleEditFormChange('interest', e.target.value)} className={`${INPUT_BASE_STYLE} !h-8 text-right`} /></td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 text-right font-medium">{formatCurrency(payment.totalPayment, account.currency)}</td>
                                        <td className="p-3 text-right text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(payment.principal, account.currency)}</td>
                                        <td className="p-3 text-right text-light-text-secondary dark:text-dark-text-secondary">{formatCurrency(payment.interest, account.currency)}</td>
                                    </>
                                )}
                                
                                <td className="p-3 text-right font-mono">{formatCurrency(payment.outstandingBalance, account.currency)}</td>
                                <td className="p-3 text-center">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full border ${
                                        payment.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900' :
                                        payment.status === 'Overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900' :
                                        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                                    }`}>{payment.status}</span>
                                </td>
                                <td className="p-3 text-right">
                                    {isEditing ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleSaveEdit} className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600"><span className="material-symbols-outlined text-lg">check</span></button>
                                            <button onClick={handleCancelEdit} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600"><span className="material-symbols-outlined text-lg">close</span></button>
                                        </div>
                                    ) : payment.status !== 'Paid' ? (
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onMakePayment(payment, `Payment #${payment.paymentNumber} for ${account.name}`)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-2 !text-xs shadow-sm`} title="Record Payment">
                                                {isLending ? 'Receive' : 'Pay'}
                                            </button>
                                            <button onClick={() => handleEditClick(payment)} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary transition-colors" title="Edit Schedule">
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                        </div>
                                    ) : null}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium p-4 bg-light-card dark:bg-dark-card rounded-lg border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex justify-between">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Total Principal</span>
                    <span>{formatCurrency(totals.principal, account.currency)}</span>
                </div>
                <div className="flex justify-between md:border-l md:border-black/10 md:dark:border-white/10 md:pl-4">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Total Interest</span>
                    <span className="text-red-500">{formatCurrency(totals.interest, account.currency)}</span>
                </div>
                <div className="flex justify-between md:border-l md:border-black/10 md:dark:border-white/10 md:pl-4">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Total Cost</span>
                    <span className="font-bold">{formatCurrency(totals.totalPayment, account.currency)}</span>
                </div>
            </div>
        </div>
    );
};

export default PaymentPlanTable;
