
import React, { useState, useMemo, useEffect } from 'react';
import { RecurringTransaction, Transaction, RecurrenceFrequency, Currency, Membership } from '../types';
import { formatCurrency, convertToEur, parseDateAsUTC } from '../utils';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, SELECT_STYLE } from '../constants';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import MembershipModal from '../components/MembershipModal';
import LoyaltyCard from '../components/LoyaltyCard';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useScheduleContext, useCategoryContext, useMembershipsContext } from '../contexts/FinancialDataContext';

// --- Helper Types for Detection ---
interface DetectedSubscription {
  key: string; // Normalized name
  merchant: string;
  amount: number;
  frequency: RecurrenceFrequency;
  confidence: 'high' | 'medium';
  averageDay: number;
  lastDate: string;
  occurrences: number;
  accountId: string;
  currency: Currency;
}

const normalizeString = (str: string) => {
    return str.toLowerCase().replace(/[^a-z]/g, ''); // aggressive normalization
};

const calculateFrequency = (intervals: number[]): RecurrenceFrequency | null => {
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // Standard deviation to ensure consistency
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 5) return null; // Intervals are too irregular

    if (avg >= 26 && avg <= 34) return 'monthly'; // ~30 days
    if (avg >= 360 && avg <= 370) return 'yearly'; // ~365 days
    if (avg >= 6 && avg <= 8) return 'weekly'; // ~7 days
    
    return null;
};

const Subscriptions: React.FC = () => {
    const { transactions } = useTransactionsContext();
    const { accounts } = useAccountsContext();
    const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction } = useScheduleContext();
    const { memberships, saveMembership, deleteMembership } = useMembershipsContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    
    const [activeTab, setActiveTab] = useState<'recurring' | 'wallet'>('recurring');
    
    const [ignoredSubscriptions, setIgnoredSubscriptions] = useLocalStorage<string[]>('ignored-subscriptions', []);
    const [detectedSubscriptions, setDetectedSubscriptions] = useState<DetectedSubscription[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
    const [subscriptionToEdit, setSubscriptionToEdit] = useState<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>(null);
    const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(null);

    // --- 1. Detection Logic ---
    useEffect(() => {
        const detect = () => {
            const groups: Record<string, Transaction[]> = {};
            const expenseTransactions = transactions.filter(t => t.type === 'expense' && !t.transferId);

            // Group by normalized description (first 10 chars to catch variations like "Netflix #123")
            expenseTransactions.forEach(tx => {
                const key = normalizeString(tx.description.substring(0, 12));
                if (!groups[key]) groups[key] = [];
                groups[key].push(tx);
            });

            const candidates: DetectedSubscription[] = [];

            Object.entries(groups).forEach(([key, groupTxs]) => {
                // Need at least 2 occurrences to detect a pattern
                if (groupTxs.length < 2) return;

                // Check if already tracked or ignored
                const isTracked = recurringTransactions.some(rt => normalizeString(rt.description).includes(key));
                if (isTracked || ignoredSubscriptions.includes(key)) return;

                // Sort by date
                groupTxs.sort((a, b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());

                // Calculate intervals
                const intervals: number[] = [];
                let lastDate = parseDateAsUTC(groupTxs[0].date);
                
                for (let i = 1; i < groupTxs.length; i++) {
                    const currentDate = parseDateAsUTC(groupTxs[i].date);
                    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    intervals.push(diffDays);
                    lastDate = currentDate;
                }
                
                const frequency = calculateFrequency(intervals);
                
                if (frequency) {
                    // Calculate average amount
                    const totalAmount = groupTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const avgAmount = totalAmount / groupTxs.length;
                    
                    // Determine "confidence" based on consistency of amount
                    const amountVariance = groupTxs.reduce((sum, t) => sum + Math.pow(Math.abs(t.amount) - avgAmount, 2), 0) / groupTxs.length;
                    const amountStdDev = Math.sqrt(amountVariance);
                    const confidence = amountStdDev < (avgAmount * 0.1) ? 'high' : 'medium'; // <10% variation

                    // Last occurrence info
                    const lastTx = groupTxs[groupTxs.length - 1];

                    candidates.push({
                        key,
                        merchant: lastTx.description, // Use the most recent description
                        amount: avgAmount,
                        frequency,
                        confidence,
                        averageDay: lastDate.getUTCDate(),
                        lastDate: lastTx.date,
                        occurrences: groupTxs.length,
                        accountId: lastTx.accountId,
                        currency: lastTx.currency
                    });
                }
            });
            
            setDetectedSubscriptions(candidates);
        };
        
        detect();
    }, [transactions, recurringTransactions, ignoredSubscriptions]);

    // --- 2. Metrics Calculation ---
    const activeSubscriptions = useMemo(() => {
        return recurringTransactions.filter(rt => rt.type === 'expense');
    }, [recurringTransactions]);

    const { monthlySpend, yearlySpend, subscriptionCount } = useMemo(() => {
        let monthly = 0;
        activeSubscriptions.forEach(sub => {
            const amount = convertToEur(sub.amount, sub.currency);
            if (sub.frequency === 'monthly') monthly += amount;
            else if (sub.frequency === 'yearly') monthly += amount / 12;
            else if (sub.frequency === 'weekly') monthly += amount * 4.33;
            else if (sub.frequency === 'daily') monthly += amount * 30;
        });
        return { monthlySpend: monthly, yearlySpend: monthly * 12, subscriptionCount: activeSubscriptions.length };
    }, [activeSubscriptions]);


    // --- Handlers ---
    const handleIgnore = (key: string) => {
        setIgnoredSubscriptions(prev => [...prev, key]);
    };

    const handleTrack = (candidate: DetectedSubscription) => {
        const account = accounts.find(a => a.id === candidate.accountId);
        // Find next due date
        const last = parseDateAsUTC(candidate.lastDate);
        const next = new Date(last);
        if (candidate.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (candidate.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
        else if (candidate.frequency === 'weekly') next.setDate(next.getDate() + 7);

        const newSub: Omit<RecurringTransaction, 'id'> = {
            accountId: candidate.accountId,
            description: candidate.merchant,
            amount: candidate.amount,
            type: 'expense',
            category: 'Entertainment', // Default assumption, user can change
            currency: candidate.currency || 'EUR',
            frequency: candidate.frequency,
            frequencyInterval: 1,
            startDate: candidate.lastDate,
            nextDueDate: next.toISOString().split('T')[0],
            weekendAdjustment: 'after',
        };
        
        setSubscriptionToEdit(newSub);
        setIsModalOpen(true);
    };

    const handleEditActive = (sub: RecurringTransaction) => {
        setSubscriptionToEdit(sub);
        setIsModalOpen(true);
    };

    const handleDeleteActive = (id: string) => {
        if (window.confirm("Are you sure you want to stop tracking this subscription?")) {
            deleteRecurringTransaction(id);
        }
    };
    
    const handleSave = (data: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
        saveRecurringTransaction(data);
        setIsModalOpen(false);
        // Remove from detected if it matches (cleanup)
        if (!data.id) {
             // Just added a new one, clear matching detected items immediately for UX
             const key = normalizeString(data.description.substring(0, 12));
             setDetectedSubscriptions(prev => prev.filter(d => d.key !== key));
        }
    };

    const handleOpenMembershipModal = (membership?: Membership) => {
        setMembershipToEdit(membership || null);
        setIsMembershipModalOpen(true);
    };

    const handleDeleteMembership = (id: string) => {
        if(window.confirm("Delete this membership card?")) {
            deleteMembership(id);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">
             {isModalOpen && (
                <RecurringTransactionModal
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    accounts={accounts}
                    incomeCategories={incomeCategories}
                    expenseCategories={expenseCategories}
                    recurringTransactionToEdit={subscriptionToEdit}
                />
            )}
            
            {isMembershipModalOpen && (
                <MembershipModal
                    onClose={() => setIsMembershipModalOpen(false)}
                    onSave={saveMembership}
                    membershipToEdit={membershipToEdit}
                />
            )}
            
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                     <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Subscriptions</h1>
                     <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage recurring payments and loyalty programs.</p>
                 </div>
                 
                 <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg self-start md:self-auto">
                    <button 
                        onClick={() => setActiveTab('recurring')} 
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'recurring' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                    >
                        <span className="material-symbols-outlined text-lg">payments</span>
                        Payments
                    </button>
                    <button 
                        onClick={() => setActiveTab('wallet')} 
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'wallet' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                    >
                        <span className="material-symbols-outlined text-lg">loyalty</span>
                        Loyalty Wallet
                    </button>
                </div>
            </header>
            
            {activeTab === 'recurring' ? (
                <>
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none relative overflow-hidden p-6">
                        <div className="relative z-10">
                            <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Monthly Cost</p>
                            <p className="text-3xl font-extrabold mt-1 privacy-blur">{formatCurrency(monthlySpend, 'EUR')}</p>
                            <p className="text-sm opacity-80 mt-2 privacy-blur">≈ {formatCurrency(yearlySpend, 'EUR')} / year</p>
                        </div>
                        <div className="absolute -right-4 -bottom-8 text-white opacity-10">
                            <span className="material-symbols-outlined text-9xl">calendar_month</span>
                        </div>
                    </Card>
                    
                    <Card className="flex flex-col justify-center p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Active Subscriptions</p>
                                <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{subscriptionCount}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="flex flex-col justify-center p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Detected Opportunities</p>
                                <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{detectedSubscriptions.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Detected Subscriptions Section */}
                {detectedSubscriptions.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">auto_awesome</span>
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Detected for You</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {detectedSubscriptions.map(sub => (
                                <div key={sub.key} className="bg-white dark:bg-dark-card border-2 border-yellow-400/30 dark:border-yellow-500/20 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-light-text dark:text-dark-text truncate">{sub.merchant}</h3>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Detected {sub.frequency} payment</p>
                                        </div>
                                        <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                                            {sub.confidence} Confidence
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-2xl font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(sub.amount, sub.currency)}</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Avg. based on {sub.occurrences} txs</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleIgnore(sub.key)} className={`${BTN_SECONDARY_STYLE} !px-3 !py-1.5 text-xs`}>Ignore</button>
                                            <button onClick={() => handleTrack(sub)} className={`${BTN_PRIMARY_STYLE} !px-3 !py-1.5 text-xs`}>Track</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Active List */}
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Your Subscriptions</h2>
                        <button onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }} className={BTN_PRIMARY_STYLE}>
                            <span className="material-symbols-outlined text-lg mr-1">add</span> Add
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-black/5 dark:border-white/5">
                                    <th className="pb-4 pl-2">Service</th>
                                    <th className="pb-4">Cost</th>
                                    <th className="pb-4">Frequency</th>
                                    <th className="pb-4">Next Due</th>
                                    <th className="pb-4 text-right pr-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                                {activeSubscriptions.map(sub => {
                                    const nextDueDate = parseDateAsUTC(sub.nextDueDate);
                                    const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    const isDueSoon = daysUntil >= 0 && daysUntil <= 3;

                                    return (
                                        <tr key={sub.id} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-4 pl-2 font-semibold text-light-text dark:text-dark-text">{sub.description}</td>
                                            <td className="py-4 font-mono font-medium privacy-blur">{formatCurrency(sub.amount, sub.currency)}</td>
                                            <td className="py-4 capitalize">
                                                <span className="bg-gray-100 dark:bg-white/10 px-2 py-1 rounded text-xs font-medium text-light-text dark:text-dark-text">
                                                    {sub.frequency}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <span className={isDueSoon ? 'text-orange-500 font-bold' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                                    {nextDueDate.toLocaleDateString()} 
                                                    {isDueSoon && <span className="text-xs ml-2 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">Due Soon</span>}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right pr-2">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditActive(sub)} className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteActive(sub.id)} className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {activeSubscriptions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                            No subscriptions tracked yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
                </>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                         <div className="flex gap-4">
                             <div className="bg-white dark:bg-dark-card rounded-lg px-4 py-2 border border-black/5 dark:border-white/5 flex items-center gap-3">
                                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                     <span className="material-symbols-outlined text-lg">card_membership</span>
                                 </div>
                                 <div>
                                     <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold">Total Cards</p>
                                     <p className="font-bold text-lg text-light-text dark:text-dark-text">{memberships.length}</p>
                                 </div>
                             </div>
                             {/* Placeholder for expiries */}
                         </div>
                         <button onClick={() => handleOpenMembershipModal()} className={BTN_PRIMARY_STYLE}>
                             <span className="material-symbols-outlined text-lg mr-2">add</span> Add Card
                         </button>
                    </div>

                    {memberships.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {memberships.map(membership => (
                                <LoyaltyCard 
                                    key={membership.id} 
                                    membership={membership} 
                                    onEdit={handleOpenMembershipModal} 
                                    onDelete={handleDeleteMembership}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center bg-light-card/50 dark:bg-dark-card/50 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500">loyalty</span>
                            </div>
                            <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">No Cards Yet</h3>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-sm mb-6">
                                Add your loyalty cards, memberships, and passes to keep them organized in one place.
                            </p>
                            <button onClick={() => handleOpenMembershipModal()} className={BTN_PRIMARY_STYLE}>
                                Add First Card
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Subscriptions;
