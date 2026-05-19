
import React, { useState, useMemo, useEffect } from 'react';
import { Account, Transaction, ScheduledPayment } from '../types';
import { generateAmortizationSchedule, formatCurrency, parseLocalDate } from '../utils';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import LoanPaymentBulkEditModal, { BulkPaymentEntry } from './LoanPaymentBulkEditModal';

interface PaymentPlanTableProps {
  account: Account;
  transactions: Transaction[];
  onMakePayment: (payment: ScheduledPayment, description: string) => void;
  overrides: Record<number, Partial<ScheduledPayment>>;
  onOverridesChange: (overrides: Record<number, Partial<ScheduledPayment>>) => void;
  showBalanceAdjustments?: boolean;
}

const PaymentPlanTable: React.FC<PaymentPlanTableProps> = ({ account, transactions, onMakePayment, overrides, onOverridesChange, showBalanceAdjustments = true }) => {
    const [editingPaymentNumber, setEditingPaymentNumber] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Pick<ScheduledPayment, 'totalPayment' | 'principal' | 'interest'>>>({});
    const [lastEditedField, setLastEditedField] = useState<'total' | 'principal' | 'interest' | null>(null);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const schedule = useMemo(() => {
        const filteredTxs = transactions.filter(tx => showBalanceAdjustments || !tx.isBalanceAdjustment);
        return generateAmortizationSchedule(account, filteredTxs, overrides);
    }, [account, transactions, overrides, showBalanceAdjustments]);

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

    const handleBulkApply = (entries: BulkPaymentEntry[]) => {
        const nextOverrides = { ...overrides };
        entries.forEach(entry => {
            nextOverrides[entry.paymentNumber] = {
                totalPayment: entry.totalPayment,
                principal: entry.principal,
                interest: entry.interest,
            };
        });
        onOverridesChange(nextOverrides);
        setIsBulkEditOpen(false);
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

    const renderPaymentCard = (payment: ScheduledPayment) => {
        const isEditing = editingPaymentNumber === payment.paymentNumber;
        return (
            <div key={payment.paymentNumber} className={`p-4 rounded-3xl bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 shadow-sm space-y-4 ${isEditing ? 'ring-2 ring-primary-500' : ''}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-light-text-secondary/40 dark:text-dark-text-secondary/40">#{payment.paymentNumber}</span>
                        <span className="font-bold text-sm">{parseLocalDate(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg border ${
                        payment.status === 'Paid' ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        payment.status === 'Overdue' ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                        'bg-slate-500/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-500/10'
                    }`}>{payment.status}</span>
                </div>

                {isEditing ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/60">Total</label>
                                <input type="number" step="0.01" value={editFormData.totalPayment} onChange={e => handleEditFormChange('totalPayment', e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 text-right`} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/60">Balance</label>
                                <div className="h-10 flex items-center justify-end px-3 bg-black/5 dark:bg-white/5 rounded-xl font-mono text-xs opacity-60">
                                    {formatCurrency(payment.outstandingBalance, account.currency)}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/60">Principal</label>
                                <input type="number" step="0.01" value={editFormData.principal} onChange={e => handleEditFormChange('principal', e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 text-right`} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/60">Interest</label>
                                <input type="number" step="0.01" value={editFormData.interest} onChange={e => handleEditFormChange('interest', e.target.value)} className={`${INPUT_BASE_STYLE} !h-10 text-right`} />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSaveEdit} className="flex-1 py-2 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-emerald-600 transition-colors">Save</button>
                            <button onClick={handleCancelEdit} className="flex-1 py-2 rounded-2xl bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary font-black uppercase tracking-widest text-[10px] hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/50 dark:text-dark-text-secondary/50">Total Payment</p>
                                <p className="font-black text-base text-primary-500">{formatCurrency(payment.totalPayment, account.currency)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/50 dark:text-dark-text-secondary/50">Remaining</p>
                                <p className="font-bold text-sm text-light-text dark:text-dark-text">{formatCurrency(payment.outstandingBalance, account.currency)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-black/5 dark:border-white/5">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/50 dark:text-dark-text-secondary/50">Principal</p>
                                <p className="font-bold text-xs text-light-text dark:text-dark-text">{formatCurrency(payment.principal, account.currency)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-light-text-secondary/50 dark:text-dark-text-secondary/50">Interest</p>
                                <p className="font-bold text-xs text-light-text dark:text-dark-text">{formatCurrency(payment.interest, account.currency)}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2 pt-3">
                             {payment.status !== 'Paid' ? (
                                <>
                                    <button onClick={() => onMakePayment(payment, `Payment #${payment.paymentNumber} for ${account.name}`)} className="flex-1 py-2.5 rounded-2xl bg-primary-500 text-white font-black uppercase tracking-widest text-[10px] shadow-sm hover:shadow-md transition-all active:scale-95">
                                        {isLending ? 'Receive' : 'PayNow'}
                                    </button>
                                    <button onClick={() => handleEditClick(payment)} className="px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary font-black uppercase tracking-widest text-[10px] hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95">
                                        Edit
                                    </button>
                                </>
                             ) : (
                                <div className="w-full py-2 rounded-2xl bg-emerald-500/5 text-emerald-500 text-center font-black uppercase tracking-widest text-[9px]">
                                    Payment Completed
                                </div>
                             )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setIsBulkEditOpen(true)} className={`${BTN_SECONDARY_STYLE} !rounded-2xl !px-4 !py-2 !text-[10px] font-black uppercase tracking-[0.1em] shadow-sm`}>
                    Bulk Edit Schedule
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 text-[10px] font-black uppercase tracking-[0.15em] p-5 bg-white dark:bg-dark-card rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex flex-col gap-1">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-50">Total Principal</span>
                    <span className="text-lg font-black tracking-tight text-light-text dark:text-dark-text">{formatCurrency(totals.principal, account.currency)}</span>
                </div>
                <div className="flex flex-col gap-1 md:border-l md:border-black/5 md:dark:border-white/5 md:pl-6">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-50">Total Interest</span>
                    <span className="text-lg font-black tracking-tight text-rose-500">{formatCurrency(totals.interest, account.currency)}</span>
                </div>
                <div className="flex flex-col gap-1 md:border-l md:border-black/5 md:dark:border-white/5 md:pl-6">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary opacity-50">Total Cost</span>
                    <span className="text-lg font-black tracking-tight text-primary-500">{formatCurrency(totals.totalPayment, account.currency)}</span>
                </div>
            </div>

            <div className="hidden sm:block flex-grow overflow-auto border border-black/5 dark:border-white/10 rounded-[2rem] bg-white dark:bg-dark-bg scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                <table className="w-full text-sm text-left relative border-collapse">
                    <thead className="text-[10px] bg-light-fill/50 dark:bg-dark-fill/50 text-light-text-secondary dark:text-dark-text-secondary font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-xl">
                        <tr>
                            <th className="p-4 whitespace-nowrap border-b border-black/5 dark:border-white/5">#</th>
                            <th className="p-4 whitespace-nowrap border-b border-black/5 dark:border-white/5">Date</th>
                            <th className="p-4 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Total</th>
                            <th className="p-4 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Principal</th>
                            <th className="p-4 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Interest</th>
                            <th className="p-4 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Balance</th>
                            <th className="p-4 whitespace-nowrap text-center border-b border-black/5 dark:border-white/5">Status</th>
                            <th className="p-4 whitespace-nowrap text-right border-b border-black/5 dark:border-white/5">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {schedule.map(payment => {
                            const isEditing = editingPaymentNumber === payment.paymentNumber;
                            return (
                            <tr key={payment.paymentNumber} className={`group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${isEditing ? 'bg-primary-500/10' : ''}`}>
                                <td className="p-4 font-mono text-[10px] opacity-40">{payment.paymentNumber}</td>
                                <td className="p-4 font-bold">{parseLocalDate(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                
                                {isEditing ? (
                                    <>
                                        <td className="p-2 text-right"><input type="number" step="0.01" value={editFormData.totalPayment} onChange={e => handleEditFormChange('totalPayment', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right`} /></td>
                                        <td className="p-2 text-right"><input type="number" step="0.01" value={editFormData.principal} onChange={e => handleEditFormChange('principal', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right`} /></td>
                                        <td className="p-2 text-right"><input type="number" step="0.01" value={editFormData.interest} onChange={e => handleEditFormChange('interest', e.target.value)} className={`${INPUT_BASE_STYLE} !h-9 text-right`} /></td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-4 text-right font-black text-primary-500 tracking-tight">{formatCurrency(payment.totalPayment, account.currency)}</td>
                                        <td className="p-4 text-right text-light-text-secondary/60 dark:text-dark-text-secondary/60 font-bold">{formatCurrency(payment.principal, account.currency)}</td>
                                        <td className="p-4 text-right text-light-text-secondary/60 dark:text-dark-text-secondary/60 font-bold">{formatCurrency(payment.interest, account.currency)}</td>
                                    </>
                                )}
                                
                                <td className="p-4 text-right font-mono text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60">{formatCurrency(payment.outstandingBalance, account.currency)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border ${
                                        payment.status === 'Paid' ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                                        payment.status === 'Overdue' ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                                        'bg-slate-500/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-500/10'
                                    }`}>{payment.status}</span>
                                </td>
                                <td className="p-3 text-right">
                                    {isEditing ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleSaveEdit} className="p-1 px-2 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 font-bold text-xs">Save</button>
                                            <button onClick={handleCancelEdit} className="p-1 px-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 font-bold text-xs">Cancel</button>
                                        </div>
                                    ) : payment.status !== 'Paid' ? (
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onMakePayment(payment, `Payment #${payment.paymentNumber} for ${account.name}`)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-3 font-black uppercase tracking-widest !text-[9px] shadow-sm active:scale-95 transition-all`} title="Record Payment">
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

            <div className="sm:hidden space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                {schedule.map(renderPaymentCard)}
            </div>

            {isBulkEditOpen && (
                <LoanPaymentBulkEditModal
                    scheduleLength={schedule.length}
                    onClose={() => setIsBulkEditOpen(false)}
                    onApply={handleBulkApply}
                />
            )}
        </div>
    );
};

export default PaymentPlanTable;
