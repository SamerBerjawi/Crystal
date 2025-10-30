import React, { useState, useMemo } from 'react';
import { RecurringTransaction, Account, Category, BillPayment, Currency } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, LIQUID_ACCOUNT_TYPES } from '../constants';
import { formatCurrency, convertToEur } from '../utils';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import Modal from '../components/Modal';
import CalendarView from '../components/CalendarView';

// --- Types for this merged page ---
export type ScheduledItem = {
    id: string;
    isRecurring: boolean;
    date: string;
    description: string;
    amount: number;
    accountName: string;
    isTransfer?: boolean;
    type: 'income' | 'expense' | 'transfer' | 'payment' | 'deposit';
    originalItem: RecurringTransaction | BillPayment;
};

// --- Modals (moved from PaymentPlan) ---
const BillPaymentModal: React.FC<{
    bill: Omit<BillPayment, 'id'> & { id?: string } | null;
    onSave: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
    onClose: () => void;
    accounts: Account[];
}> = ({ bill, onSave, onClose, accounts }) => {
    const isEditing = !!bill?.id;
    const [description, setDescription] = useState(bill?.description || '');
    const [amount, setAmount] = useState(bill ? String(Math.abs(bill.amount)) : '');
    const [type, setType] = useState<'payment' | 'deposit'>(bill?.type || 'payment');
    const [dueDate, setDueDate] = useState(bill?.dueDate || new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: bill?.id,
            description,
            amount: type === 'payment' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
            type,
            currency: 'EUR',
            dueDate,
            status: bill?.status || 'unpaid',
        });
        onClose();
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    return (
        <Modal onClose={onClose} title={isEditing ? 'Edit Bill/Payment' : 'Add Bill/Payment'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg">
                    <button type="button" onClick={() => setType('payment')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'payment' ? 'bg-red-500 text-white' : ''}`}>Payment (Out)</button>
                    <button type="button" onClick={() => setType('deposit')} className={`w-full py-2 rounded text-sm font-semibold ${type === 'deposit' ? 'bg-green-500 text-white' : ''}`}>Deposit (In)</button>
                </div>
                <div><label htmlFor="desc" className={labelStyle}>Description</label><input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="amount" className={labelStyle}>Amount (€)</label><input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                    <div><label htmlFor="dueDate" className={labelStyle}>Due Date</label><input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_BASE_STYLE} required /></div>
                </div>
                <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="submit" className={BTN_PRIMARY_STYLE}>{isEditing ? 'Save Changes' : 'Add Item'}</button></div>
            </form>
        </Modal>
    );
};

// --- Item Row Component ---
const ScheduledItemRow: React.FC<{
    item: ScheduledItem;
    accounts: Account[];
    onEdit: (item: RecurringTransaction | BillPayment) => void;
    onDelete: (id: string, isRecurring: boolean) => void;
    onMarkAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
}> = ({ item, accounts, onEdit, onDelete, onMarkAsPaid }) => {
    
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const originalBill = !item.isRecurring ? item.originalItem as BillPayment : null;
    const [paymentAccountId, setPaymentAccountId] = useState(originalBill?.accountId || accounts.find(a => LIQUID_ACCOUNT_TYPES.includes(a.type))?.id || '');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isOverdue = !item.isRecurring && item.date < new Date().toISOString().split('T')[0];

    const handleConfirmPayment = () => {
        if (!paymentAccountId) { alert('Please select an account.'); return; }
        if (originalBill) onMarkAsPaid(originalBill.id, paymentAccountId, paymentDate);
        setIsConfirmingPayment(false);
    };

    const dueDate = new Date(item.date);
    // Adjust for timezone display issues by parsing as UTC
    const day = new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()).getDate();
    const month = dueDate.toLocaleString('default', { month: 'short' }).toUpperCase();
    
    return (
      <div className="flex items-center justify-between p-4 group">
        {isConfirmingPayment && originalBill && (
          <Modal onClose={() => setIsConfirmingPayment(false)} title={`Confirm ${isIncome ? 'Deposit' : 'Payment'}`}>
            <div className="space-y-4">
              <p>Mark "<strong>{originalBill.description}</strong>" for <strong>{formatCurrency(originalBill.amount, originalBill.currency)}</strong> as paid.</p>
              <div><label className="block text-sm font-medium mb-1">Account</label><div className={SELECT_WRAPPER_STYLE}><select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={INPUT_BASE_STYLE} required><option value="" disabled>Select an account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
              <div><label className="block text-sm font-medium mb-1">Payment Date</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
              <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={() => setIsConfirmingPayment(false)} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="button" onClick={handleConfirmPayment} className={BTN_PRIMARY_STYLE}>Confirm</button></div>
            </div>
          </Modal>
        )}
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 text-center rounded-lg p-2 w-16 ${isOverdue ? 'bg-red-100 dark:bg-red-900/40' : 'bg-light-bg dark:bg-dark-bg'}`}>
            <p className={`text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-primary-500'}`}>{month}</p>
            <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{day}</p>
          </div>
          <div>
            <p className="font-semibold text-lg text-light-text dark:text-dark-text">{item.description}</p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{item.accountName} &bull; {item.isRecurring ? (item.originalItem as RecurringTransaction).frequency : 'One-time'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className={`font-semibold text-base ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(item.amount, 'EUR')}
          </p>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {!item.isRecurring && <button onClick={() => setIsConfirmingPayment(true)} className={`${BTN_PRIMARY_STYLE} !py-1 !px-2 text-xs`} title="Mark as Paid"><span className="material-symbols-outlined text-sm">check</span></button>}
            <button onClick={() => onEdit(item.originalItem)} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><span className="material-symbols-outlined text-base">edit</span></button>
            <button onClick={() => onDelete(item.id, item.isRecurring)} className="text-red-500/80 p-2 rounded-full hover:bg-red-500/10" title="Delete"><span className="material-symbols-outlined text-base">delete</span></button>
          </div>
        </div>
      </div>
    );
};

// --- Main Page Component ---

interface ScheduleProps {
    recurringTransactions: RecurringTransaction[];
    saveRecurringTransaction: (recurringData: Omit<RecurringTransaction, 'id'> & { id?: string }) => void;
    deleteRecurringTransaction: (id: string) => void;
    billsAndPayments: BillPayment[];
    saveBillPayment: (data: Omit<BillPayment, 'id'> & { id?: string }) => void;
    deleteBillPayment: (id: string) => void;
    markBillAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
    accounts: Account[];
    incomeCategories: Category[];
    expenseCategories: Category[];
}

const Schedule: React.FC<ScheduleProps> = (props) => {
    const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, billsAndPayments, saveBillPayment, deleteBillPayment, markBillAsPaid, accounts, incomeCategories, expenseCategories } = props;

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
    const [editingBill, setEditingBill] = useState<BillPayment | null>(null);

    const accountMap = React.useMemo(() => accounts.reduce((acc, current) => {
        acc[current.id] = current.name;
        return acc;
    }, {} as Record<string, string>), [accounts]);
    
    const { summary, upcomingItems, paidItems } = useMemo(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const dateIn30Days = new Date(today); dateIn30Days.setDate(today.getDate() + 30);

        let income30 = 0; let expense30 = 0;

        const allUpcomingItems: ScheduledItem[] = [];

        recurringTransactions.forEach(rt => {
            allUpcomingItems.push({
                id: rt.id, isRecurring: true, date: rt.nextDueDate, description: rt.description,
                amount: rt.type === 'expense' ? -rt.amount : rt.amount,
                accountName: rt.type === 'transfer' ? `${accountMap[rt.accountId]} → ${accountMap[rt.toAccountId!]}` : accountMap[rt.accountId],
                type: rt.type, originalItem: rt, isTransfer: rt.type === 'transfer'
            });
        });

        billsAndPayments.filter(b => b.status === 'unpaid').forEach(b => {
             allUpcomingItems.push({
                id: b.id, isRecurring: false, date: b.dueDate, description: b.description,
                amount: b.amount, accountName: 'One-time', type: b.type, originalItem: b
            });
        });

        allUpcomingItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        allUpcomingItems.forEach(item => {
            const dueDate = new Date(item.date);
            if (dueDate >= today && dueDate <= dateIn30Days) {
                const amount = convertToEur(item.amount, 'EUR');
                if (amount > 0) income30 += amount;
                else expense30 += Math.abs(amount);
            }
        });
        
        const paidItems = billsAndPayments.filter(b => b.status === 'paid').sort((a,b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

        return {
            summary: { income: income30, expenses: expense30, net: income30 - expense30 },
            upcomingItems: allUpcomingItems,
            paidItems
        };
    }, [recurringTransactions, billsAndPayments, accountMap]);


    const handleAddRecurringClick = () => { setEditingTransaction(null); setIsRecurringModalOpen(true); };
    const handleAddBillClick = () => { setEditingBill(null); setIsBillModalOpen(true); };

    const handleEdit = (item: RecurringTransaction | BillPayment) => {
        if ('frequency' in item) { // It's a RecurringTransaction
            setEditingTransaction(item);
            setIsRecurringModalOpen(true);
        } else { // It's a BillPayment
            setEditingBill(item);
            setIsBillModalOpen(true);
        }
    };
    
    const handleDelete = (id: string, isRecurring: boolean) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            if (isRecurring) deleteRecurringTransaction(id);
            else deleteBillPayment(id);
        }
    };
    
    const renderPaidItem = (bill: BillPayment) => (
         <div className="flex items-center justify-between p-4 opacity-70">
            <div className="flex items-center gap-4">
                <span className={`material-symbols-outlined text-3xl ${bill.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>{bill.type === 'deposit' ? 'add_card' : 'credit_card'}</span>
                <div>
                    <p className="font-semibold text-light-text dark:text-dark-text">{bill.description}</p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Paid on {new Date(bill.dueDate).toLocaleDateString()}</p>
                </div>
            </div>
             <p className={`font-semibold text-lg ${bill.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(bill.amount, bill.currency)}</p>
        </div>
    );
    
    const ListView = () => {
        const today = new Date(); today.setHours(0,0,0,0);
        const dateIn7Days = new Date(today); dateIn7Days.setDate(today.getDate() + 7);
        const dateIn30Days = new Date(today); dateIn30Days.setDate(today.getDate() + 30);

        const groups = {
            next7Days: upcomingItems.filter(item => new Date(item.date) <= dateIn7Days),
            next30Days: upcomingItems.filter(item => new Date(item.date) > dateIn7Days && new Date(item.date) <= dateIn30Days),
            later: upcomingItems.filter(item => new Date(item.date) > dateIn30Days)
        };
        
        const renderGroup = (title: string, items: ScheduledItem[]) => {
            if (items.length === 0) return null;
            return (
                <div key={title}>
                    <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">{title}</h3>
                    <Card><div className="divide-y divide-black/5 dark:divide-white/5 -m-4">{items.map(item => <ScheduledItemRow key={item.id} item={item} accounts={accounts} onEdit={handleEdit} onDelete={handleDelete} onMarkAsPaid={markBillAsPaid}/>)}</div></Card>
                </div>
            )
        };

        return (
            <div className="space-y-6">
                 {renderGroup('Next 7 Days', groups.next7Days)}
                 {renderGroup('Next 30 Days', groups.next30Days)}
                 {renderGroup('Later', groups.later)}
                 
                 {upcomingItems.length === 0 && (
                     <Card><div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary"><span className="material-symbols-outlined text-5xl mb-2">event_available</span><p className="font-semibold">Your schedule is clear.</p><p className="text-sm">Add a recurring transaction or a one-time bill to get started.</p></div></Card>
                 )}
                 
                 {paidItems.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">Paid / Received History</h3>
                        <Card><div className="divide-y divide-black/5 dark:divide-white/5 -m-4">{paidItems.map(item => renderPaidItem(item))}</div></Card>
                    </div>
                 )}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {isRecurringModalOpen && <RecurringTransactionModal onClose={() => setIsRecurringModalOpen(false)} onSave={(d)=>{saveRecurringTransaction(d); setIsRecurringModalOpen(false);}} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} recurringTransactionToEdit={editingTransaction}/>}
            {isBillModalOpen && <BillPaymentModal bill={editingBill} onSave={(d)=>{saveBillPayment(d); setIsBillModalOpen(false);}} onClose={() => setIsBillModalOpen(false)} accounts={accounts} />}
            
            <header className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Schedule & Bills</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your recurring payments, bills, and expected income.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-neu-inset-light dark:shadow-neu-inset-dark h-11 items-center">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ${
                                viewMode === 'calendar'
                                ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark'
                                : 'text-light-text-secondary dark:text-dark-text-secondary'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">calendar_month</span>
                            Calendar
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all duration-200 ${
                                viewMode === 'list'
                                ? 'bg-light-card dark:bg-dark-card shadow-neu-raised-light dark:shadow-neu-raised-dark'
                                : 'text-light-text-secondary dark:text-dark-text-secondary'
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">view_list</span>
                            List
                        </button>
                    </div>
                    <button onClick={handleAddBillClick} className={BTN_SECONDARY_STYLE}>Add Bill/Payment</button>
                    <button onClick={handleAddRecurringClick} className={BTN_PRIMARY_STYLE}>Add Recurring</button>
                </div>
            </header>

            <Card>
                <h3 className="text-xl font-semibold mb-4">Next 30 Days Forecast</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div><p className="text-base text-green-500">Income</p><p className="text-2xl font-bold">{formatCurrency(summary.income, 'EUR')}</p></div>
                    <div><p className="text-base text-red-500">Expenses</p><p className="text-2xl font-bold">{formatCurrency(summary.expenses, 'EUR')}</p></div>
                    <div><p className="text-base text-light-text-secondary dark:text-dark-text-secondary">Net Cash Flow</p><p className={`text-2xl font-bold ${summary.net >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(summary.net, 'EUR')}</p></div>
                </div>
            </Card>
            
            {viewMode === 'calendar' ? (
                <CalendarView
                    items={upcomingItems}
                    accounts={accounts}
                    onEditItem={handleEdit}
                    onDeleteItem={handleDelete}
                    onMarkAsPaid={markBillAsPaid}
                />
            ) : (
                <ListView />
            )}
        </div>
    );
};

export default Schedule;