
import React, { useState, useMemo, useEffect } from 'react';
import { RecurringTransaction, Transaction, RecurrenceFrequency, Currency, Membership } from '../types';
import { formatCurrency, convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE } from '../constants';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import MembershipModal from '../components/MembershipModal';
import LoyaltyCard from '../components/LoyaltyCard';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useScheduleContext, useCategoryContext } from '../contexts/FinancialDataContext';
import PageHeader from '../components/PageHeader';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { motion, AnimatePresence } from 'motion/react';

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
    const { 
        recurringTransactions, 
        saveRecurringTransaction, 
        deleteRecurringTransaction,
        memberships,
        saveMembership,
        deleteMembership
    } = useScheduleContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
    const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
    
    const [ignoredSubscriptions, setIgnoredSubscriptions] = useLocalStorage<string[]>('ignored-subscriptions', []);
    const [detectedSubscriptions, setDetectedSubscriptions] = useState<DetectedSubscription[]>([]);
    const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
    
    const [activeTab, setActiveTab] = useState<'recurring' | 'loyalty'>('recurring');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [subscriptionToEdit, setSubscriptionToEdit] = useState<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>(null);

    const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
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
                groupTxs.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

                // Calculate intervals
                const intervals: number[] = [];
                let lastDate = parseLocalDate(groupTxs[0].date);
                
                for (let i = 1; i < groupTxs.length; i++) {
                    const currentDate = parseLocalDate(groupTxs[i].date);
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
                        merchant: lastTx.merchant || lastTx.description, // Use the most recent description
                        amount: avgAmount,
                        frequency,
                        confidence,
                        averageDay: lastDate.getDate(),
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
        return recurringTransactions.filter(rt => rt.type === 'expense' && !rt.isSynthetic).sort((a, b) => {
            return parseLocalDate(a.nextDueDate).getTime() - parseLocalDate(b.nextDueDate).getTime();
        });
    }, [recurringTransactions]);

    const { monthlySpend, yearlySpend, totalCount, dueSoonCount } = useMemo(() => {
        let monthly = 0;
        let dueSoon = 0;
        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(today.getDate() + 7);

        activeSubscriptions.forEach(sub => {
            const amount = convertToEur(sub.amount, sub.currency);
            if (sub.frequency === 'monthly') monthly += amount;
            else if (sub.frequency === 'yearly') monthly += amount / 12;
            else if (sub.frequency === 'weekly') monthly += amount * 4.33;
            else if (sub.frequency === 'daily') monthly += amount * 30;

            const nextDue = parseLocalDate(sub.nextDueDate);
            if (nextDue >= today && nextDue <= next7Days) {
                dueSoon++;
            }
        });
        return { monthlySpend: monthly, yearlySpend: monthly * 12, totalCount: activeSubscriptions.length, dueSoonCount: dueSoon };
    }, [activeSubscriptions]);
    
    // Calculate which days of the month have subscriptions (1-31)
    const subscriptionDays = useMemo(() => {
        const days = new Set<number>();
        activeSubscriptions.forEach(sub => {
            const date = parseLocalDate(sub.nextDueDate);
            days.add(date.getDate());
        });
        return days;
    }, [activeSubscriptions]);
    
    // Loyalty Metrics
    const expiringMemberships = useMemo(() => {
        const now = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        return memberships.filter(m => {
            if (!m.expiryDate) return false;
            const exp = new Date(m.expiryDate);
            return exp > now && exp <= nextMonth;
        }).length;
    }, [memberships]);
    
    // Group memberships by category
    const groupedMemberships = useMemo(() => {
        const groups: Record<string, Membership[]> = {};
        memberships.forEach(m => {
            const cat = m.category || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(m);
        });
        return groups;
    }, [memberships]);

    const sortedMembershipCategories = useMemo(() => Object.keys(groupedMemberships).sort(), [groupedMemberships]);


    // --- Handlers ---
    const handleIgnore = (key: string) => {
        setIgnoredSubscriptions(prev => [...prev, key]);
        setDetectedSubscriptions(prev => prev.filter(s => s.key !== key));
    };

    const handleTrack = (candidate: DetectedSubscription) => {
        const account = accounts.find(a => a.id === candidate.accountId);
        // Find next due date
        const last = parseLocalDate(candidate.lastDate);
        const next = new Date(last);
        if (candidate.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (candidate.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
        else if (candidate.frequency === 'weekly') next.setDate(next.getDate() + 7);

        const newSub: Omit<RecurringTransaction, 'id'> = {
            accountId: candidate.accountId,
            description: candidate.merchant, // Initial description is merchant name
            merchant: candidate.merchant, // Pre-fill merchant field
            amount: candidate.amount,
            type: 'expense',
            category: 'Subscriptions', // Default assumption, user can change
            currency: candidate.currency || 'EUR',
            frequency: candidate.frequency,
            frequencyInterval: 1,
            startDate: candidate.lastDate,
            nextDueDate: toLocalISOString(next),
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
    
    // Loyalty Handlers
    const handleAddMembership = () => {
        setMembershipToEdit(null);
        setIsMembershipModalOpen(true);
    };
    
    const handleEditMembership = (membership: Membership) => {
        setMembershipToEdit(membership);
        setIsMembershipModalOpen(true);
    };
    
    const handleDeleteMembershipRequest = (id: string) => {
        if(window.confirm('Delete this membership card?')) {
            deleteMembership(id);
        }
    };

    const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

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
                    onSave={(m) => { saveMembership(m); setIsMembershipModalOpen(false); }}
                    membershipToEdit={membershipToEdit}
                />
            )}
            
            <PageHeader
                markerIcon="autorenew"
                markerLabel="Renewal Hub"
                title="Subscriptions & Loyalty"
                subtitle="Track recurring expenses and manage your membership rewards effortlessly."
                actions={
                     activeTab === 'recurring' ? (
                        <button onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 group`}>
                            <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">add</span> 
                            <span>New Subscription</span>
                        </button>
                     ) : (
                        <button onClick={handleAddMembership} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 group`}>
                             <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">add</span> 
                             <span>Add Card</span>
                        </button>
                     )
                }
            />
            
            {/* View Switcher */}
            <div className="flex justify-center -mt-4">
                 <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('recurring')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${activeTab === 'recurring' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
                    >
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        Payments
                    </button>
                    <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all duration-300 ${activeTab === 'loyalty' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
                    >
                        <span className="material-symbols-outlined text-lg">wallet</span>
                        Wallet
                    </button>
                </div>
            </div>

            {/* Recurring Payments Section */}
            {activeTab === 'recurring' && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-10"
                >
                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Total Monthly Spend */}
                        <div className="bg-white dark:bg-dark-card rounded-[2rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 bg-primary-500 rounded-bl-[2rem] group-hover:opacity-10 transition-opacity">
                                <span className="material-symbols-outlined text-4xl">payments</span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Monthly Spend</p>
                            <h3 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {formatCurrency(monthlySpend, 'EUR')}
                            </h3>
                            <p className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-primary-500"></span>
                                {formatCurrency(yearlySpend, 'EUR')} / Year
                            </p>
                        </div>

                        {/* Subscription Count */}
                        <div className="bg-white dark:bg-dark-card rounded-[2rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 bg-indigo-500 rounded-bl-[2rem] group-hover:opacity-10 transition-opacity">
                                <span className="material-symbols-outlined text-4xl">subscriptions</span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Active Services</p>
                            <h3 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {totalCount}
                            </h3>
                            <p className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                                Shared across {accounts.length} accounts
                            </p>
                        </div>

                        {/* Upcoming Renewals */}
                        <div className="bg-white dark:bg-dark-card rounded-[2rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 bg-orange-500 rounded-bl-[2rem] group-hover:opacity-10 transition-opacity">
                                <span className="material-symbols-outlined text-4xl">event_upcoming</span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Next 7 Days</p>
                            <h3 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {dueSoonCount}
                            </h3>
                            <p className="text-[10px] font-bold text-orange-600/60 dark:text-orange-400/60 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                                Action required soon
                            </p>
                        </div>

                        {/* Calendar visual placeholder or Summary */}
                        <div className="bg-white dark:bg-dark-card rounded-[2rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-3">Cycle Overview</p>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: 31 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-4 h-4 rounded-md text-[8px] flex items-center justify-center font-bold transition-all ${subscriptionDays.has(i + 1) ? 'bg-primary-500 text-white scale-110 shadow-sm' : 'bg-black/5 dark:bg-white/5 text-transparent'}`}
                                    >
                                        {i+1}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Detection Alert Section */}
                    <AnimatePresence>
                        {detectedSubscriptions.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-primary-700 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10"
                            >
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-[100px] pointer-events-none" />
                                
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6 bg-white/10 w-fit px-4 py-1.5 rounded-full backdrop-blur-xl border border-white/20">
                                        <span className="material-symbols-outlined text-sm text-yellow-300">verified</span>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Smart Detection</h3>
                                    </div>

                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-8">
                                        <div>
                                            <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">We found potential subscriptions.</h2>
                                            <p className="text-white/60 font-medium text-sm">Automated analysis identified {detectedSubscriptions.length} recurring payment patterns.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {detectedSubscriptions.map((sub, idx) => {
                                            const logoUrl = getMerchantLogoUrl(sub.merchant, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                            const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);

                                            return (
                                                <motion.div 
                                                    key={sub.key} 
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    className="bg-white/10 backdrop-blur-2xl px-5 py-4 rounded-3xl border border-white/10 flex flex-col justify-between group hover:bg-white/20 transition-all cursor-default"
                                                >
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/20 shadow-xl ${hasLogo ? 'bg-white' : 'bg-white/10'}`}>
                                                                {hasLogo ? (
                                                                    <img src={logoUrl!} alt="" className="w-full h-full object-contain" onError={() => handleLogoError(logoUrl!)} />
                                                                ) : (
                                                                    <span className="text-xl font-black text-white/40">{sub.merchant.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-white font-black text-lg tracking-tight truncate leading-none mb-1">{sub.merchant}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">{sub.frequency}</span>
                                                                    <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                                                    <span className="text-[10px] font-black text-white/50">DAY {sub.averageDay}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-lg font-black text-white tracking-tighter">{formatCurrency(sub.amount, sub.currency)}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleIgnore(sub.key)} 
                                                            className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/100 hover:bg-white/10 rounded-xl transition-all"
                                                        >
                                                            Dismiss
                                                        </button>
                                                        <button 
                                                            onClick={() => handleTrack(sub)} 
                                                            className="flex-1 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-indigo-700 rounded-xl hover:scale-[1.03] active:scale-[0.98] transition-all shadow-lg"
                                                        >
                                                            Start Tracking
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {/* Active Subscriptions List */}
                    <div className="space-y-6 mt-12 bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between pb-6 border-b border-black/5 dark:border-white/5">
                            <div>
                                <h2 className="text-2xl font-black text-light-text dark:text-dark-text tracking-tighter">Active Services</h2>
                                <p className="text-sm font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60">Managed recurring commitments</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-6">
                            {activeSubscriptions.length === 0 ? (
                                <div className="col-span-full p-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                                    No active subscriptions.
                                </div>
                            ) : (
                                activeSubscriptions.map((sub, idx) => {
                                    const nextDueDate = parseLocalDate(sub.nextDueDate);
                                    const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    const isDueSoon = daysUntil >= 0 && daysUntil <= 3;
                                    const isOverdue = daysUntil < 0;
                                    
                                    const merchantName = sub.merchant || sub.description;
                                    const logoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                    const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                    const initial = merchantName.charAt(0).toUpperCase();
 
                                    let cycleLength = 30;
                                    if (sub.frequency === 'weekly') cycleLength = 7;
                                    if (sub.frequency === 'yearly') cycleLength = 365;
                                    const progress = Math.max(0, Math.min(100, ((cycleLength - daysUntil) / cycleLength) * 100));
 
                                    return (
                                        <motion.div 
                                            key={sub.id} 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group relative bg-gray-50/50 dark:bg-white/[0.02] rounded-[2.5rem] p-6 flex flex-col gap-6 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all ${isOverdue ? 'bg-rose-500' : isDueSoon ? 'bg-orange-500' : 'bg-primary-500 opacity-20'}`} />
                                            
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 ${hasLogo ? 'bg-white shadow-sm' : 'bg-gray-100 dark:bg-white/10'}`}>
                                                        {hasLogo ? (
                                                            <img src={logoUrl!} alt="" className="w-8 h-8 object-contain" onError={() => handleLogoError(logoUrl!)} />
                                                        ) : (
                                                            <span className="text-xl font-black text-gray-400 dark:text-gray-600">{initial}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-lg font-black text-light-text dark:text-dark-text tracking-tight truncate leading-none mb-1.5">{merchantName}</h4>
                                                        <span className="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-[9px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest">{sub.frequency}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">{formatCurrency(sub.amount, sub.currency)}</p>
                                                </div>
                                            </div>
 
                                            {/* Progress Section */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest overflow-hidden items-center">
                                                    <span className={isOverdue ? 'text-rose-500' : isDueSoon ? 'text-orange-500' : 'opacity-40 text-light-text-secondary dark:text-dark-text-secondary'}>
                                                        {isOverdue ? 'Overdue' : isDueSoon ? `${daysUntil}d left` : `Due: ${nextDueDate.toLocaleDateString()}`}
                                                    </span>
                                                    <span className="opacity-40 text-light-text-secondary dark:text-dark-text-secondary font-bold">{Math.round(progress)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={`h-full ${isOverdue ? 'bg-rose-500' : isDueSoon ? 'bg-orange-500' : 'bg-primary-500'}`} />
                                                </div>
                                            </div>
 
                                            {/* Actions */}
                                            <div className="flex gap-2 pt-2">
                                                <button onClick={() => handleEditActive(sub)} className="flex-1 h-10 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-primary-500 hover:text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300">
                                                    <span className="material-symbols-outlined text-lg">settings</span>
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDeleteActive(sub.id)} className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all duration-300">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Loyalty Wallet Section */}
            {activeTab === 'loyalty' && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-10"
                >
                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 bg-blue-500 rounded-bl-[2rem]">
                                <span className="material-symbols-outlined text-4xl">style</span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Total Cards</p>
                            <h3 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {memberships.length}
                            </h3>
                            <p className="text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                Membership assets
                            </p>
                        </div>

                        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 border border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 bg-amber-500 rounded-bl-[2rem]">
                                <span className="material-symbols-outlined text-4xl">timer</span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1">Expiring Soon</p>
                            <h3 className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">
                                {expiringMemberships}
                            </h3>
                            <p className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 mt-2 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                Attention needed
                            </p>
                        </div>
                    </div>

                    {memberships.length > 0 ? (
                        <div className="space-y-12">
                            {sortedMembershipCategories.map(category => {
                                const cards = groupedMemberships[category];
                                return (
                                    <div key={category} className="space-y-6">
                                        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                                {category}
                                                <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/5 text-[10px] flex items-center justify-center font-bold">{cards.length}</span>
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                            {cards.map(m => (
                                                <LoyaltyCard 
                                                    key={m.id}
                                                    membership={m}
                                                    onEdit={handleEditMembership}
                                                    onDelete={handleDeleteMembershipRequest}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-32 text-center bg-gray-50/50 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-black/5 dark:border-white/5">
                            <div className="w-24 h-24 bg-white dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-black/5 dark:border-white/10">
                                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-700">loyalty</span>
                            </div>
                            <h3 className="text-xl font-black text-light-text dark:text-dark-text tracking-tighter">Your wallet is empty</h3>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto mt-2 font-medium">
                                Keep your membership numbers and reward programs organized in one place.
                            </p>
                            <button onClick={handleAddMembership} className={`${BTN_PRIMARY_STYLE} mt-8`}>Add First Card</button>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};

export default Subscriptions;
