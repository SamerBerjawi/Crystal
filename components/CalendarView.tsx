import React, { useState, useMemo } from 'react';
import { RecurringTransaction, BillPayment, Account } from '../types';
import Card from './Card';
import Modal from './Modal';
import { formatCurrency } from '../utils';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, LIQUID_ACCOUNT_TYPES, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';

type ScheduledItem = {
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

interface CalendarViewProps {
  items: ScheduledItem[];
  accounts: Account[];
  onEditItem: (item: RecurringTransaction | BillPayment) => void;
  onDeleteItem: (id: string, isRecurring: boolean) => void;
  onMarkAsPaid: (billId: string, paymentAccountId: string, paymentDate: string) => void;
}

const CalendarItem: React.FC<{
    item: ScheduledItem,
    onEdit: () => void,
    onDelete: () => void,
    onMarkAsPaidRequest: () => void,
}> = ({ item, onEdit, onDelete, onMarkAsPaidRequest }) => {
    const isIncome = item.type === 'income' || item.type === 'deposit';
    const isBill = !item.isRecurring;
    const isOverdue = isBill && item.date < new Date().toISOString().split('T')[0];

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    }

    return (
        <div onClick={onEdit} className="group relative text-xs p-1.5 rounded-md cursor-pointer mb-1 transition-colors bg-light-card dark:bg-dark-card hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isIncome ? 'bg-green-500' : 'bg-red-500'}`} />
                <p className="font-semibold truncate flex-1">{item.description}</p>
                <p className={`font-mono ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(item.amount, 'EUR')}</p>
            </div>
            {isOverdue && <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full border-2 border-light-bg dark:border-dark-bg" title="Overdue"></div>}
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-light-card dark:bg-dark-card rounded-full shadow-md p-0.5 flex items-center translate-x-1/2 -translate-y-1/2 z-10">
                {isBill && <button onClick={(e) => handleActionClick(e, onMarkAsPaidRequest)} className="p-1 rounded-full hover:bg-green-500/10 text-green-500" title="Mark as Paid"><span className="material-symbols-outlined text-sm">check</span></button>}
                <button onClick={(e) => handleActionClick(e, onEdit)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><span className="material-symbols-outlined text-sm">edit</span></button>
                <button onClick={(e) => handleActionClick(e, onDelete)} className="p-1 rounded-full hover:bg-red-500/10 text-red-500/80" title="Delete"><span className="material-symbols-outlined text-sm">delete</span></button>
            </div>
        </div>
    );
}

const CalendarView: React.FC<CalendarViewProps> = ({ items, accounts, onEditItem, onDeleteItem, onMarkAsPaid }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<{ date: Date, items: ScheduledItem[] } | null>(null);
    const [billToPay, setBillToPay] = useState<BillPayment | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState(accounts.find(a => LIQUID_ACCOUNT_TYPES.includes(a.type))?.id || '');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const { gridDays, itemsByDate, monthLabels } = useMemo(() => {
        const itemsMap = new Map<string, ScheduledItem[]>();
        items.forEach(item => {
            const dateStr = item.date;
            if (!itemsMap.has(dateStr)) itemsMap.set(dateStr, []);
            itemsMap.get(dateStr)!.push(item);
        });

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        
        const leadingPadding = Array(firstDay.getDay()).fill(null);
        const grid = [...leadingPadding, ...days];

        // This is simplified and might not show month labels perfectly but is sufficient
        const monthLabels = [{ label: viewDate.toLocaleString('default', { month: 'long' }), colStart: 1 }];

        return { gridDays: grid, itemsByDate: itemsMap, monthLabels };
    }, [viewDate, items]);

    const changeMonth = (offset: number) => setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + offset); return d; });

    const handleMarkAsPaidRequest = (bill: BillPayment) => {
        setBillToPay(bill);
        setPaymentAccountId(bill.accountId || accounts.find(a => LIQUID_ACCOUNT_TYPES.includes(a.type))?.id || '');
        setPaymentDate(new Date().toISOString().split('T')[0]);
    };

    const handleConfirmPayment = () => {
        if (!billToPay || !paymentAccountId) return;
        onMarkAsPaid(billToPay.id, paymentAccountId, paymentDate);
        setBillToPay(null);
    };

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <Card>
            {billToPay && (
                <Modal onClose={() => setBillToPay(null)} title={`Confirm Payment`}>
                    <div className="space-y-4">
                        <p>Mark "<strong>{billToPay.description}</strong>" for <strong>{formatCurrency(billToPay.amount, billToPay.currency)}</strong> as paid.</p>
                        <div><label className="block text-sm font-medium mb-1">Account</label><div className={SELECT_WRAPPER_STYLE}><select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={INPUT_BASE_STYLE} required><option value="" disabled>Select an account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                        <div><label className="block text-sm font-medium mb-1">Payment Date</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={INPUT_BASE_STYLE} /></div>
                        <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={() => setBillToPay(null)} className={BTN_SECONDARY_STYLE}>Cancel</button><button type="button" onClick={handleConfirmPayment} className={BTN_PRIMARY_STYLE}>Confirm</button></div>
                    </div>
                </Modal>
            )}

            {selectedDay && (
                 <Modal onClose={() => setSelectedDay(null)} title={`Events for ${selectedDay.date.toLocaleDateString()}`}>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {selectedDay.items.map(item => (
                             <CalendarItem
                                key={item.id}
                                item={item}
                                onEdit={() => onEditItem(item.originalItem)}
                                onDelete={() => onDeleteItem(item.id, item.isRecurring)}
                                onMarkAsPaidRequest={() => handleMarkAsPaidRequest(item.originalItem as BillPayment)}
                            />
                        ))}
                    </div>
                 </Modal>
            )}

            <header className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">chevron_left</span></button>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">chevron_right</span></button>
                    <button onClick={() => setViewDate(new Date())} className={BTN_SECONDARY_STYLE + " !py-1.5 !px-3 !text-sm"}>Today</button>
                </div>
                <h3 className="text-xl font-semibold text-center">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            </header>
            
            <div className="grid grid-cols-7 text-center font-semibold text-xs text-light-text-secondary dark:text-dark-text-secondary border-b border-black/10 dark:border-white/10 pb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
            </div>

            <div className="grid grid-cols-7">
                {gridDays.map((day, index) => {
                    const dateStr = day?.toISOString().split('T')[0];
                    const itemsOnDay = dateStr ? itemsByDate.get(dateStr) || [] : [];
                    const isToday = dateStr === todayStr;
                    return (
                        <div key={index} className="h-40 border-b border-r border-black/5 dark:border-white/5 p-1 flex flex-col overflow-hidden">
                            {day && (
                                <>
                                    <div className="flex justify-end">
                                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-500 text-white' : ''}`}>
                                            {day.getDate()}
                                        </span>
                                    </div>
                                    <div className="flex-grow overflow-y-auto -mx-1 px-1">
                                        {itemsOnDay.slice(0, 2).map(item => (
                                            <CalendarItem
                                                key={item.id}
                                                item={item}
                                                onEdit={() => onEditItem(item.originalItem)}
                                                onDelete={() => onDeleteItem(item.id, item.isRecurring)}
                                                onMarkAsPaidRequest={() => handleMarkAsPaidRequest(item.originalItem as BillPayment)}
                                            />
                                        ))}
                                    </div>
                                    {itemsOnDay.length > 2 && (
                                        <button onClick={() => setSelectedDay({date: day, items: itemsOnDay})} className="text-xs text-primary-500 font-semibold hover:underline text-left mt-1">
                                            + {itemsOnDay.length - 2} more
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default CalendarView;
