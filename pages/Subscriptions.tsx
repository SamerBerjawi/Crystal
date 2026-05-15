
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

type SubscriptionSegment = 'all' | 'recurring' | 'loyalty';

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
    
    const [activeSegment, setActiveSegment] = useState<SubscriptionSegment>('all');

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

    const segments: { id: SubscriptionSegment; label: string; icon: string; color: string }[] = [
        { id: 'all', label: 'Overview', icon: 'dashboard', color: 'indigo' },
        { id: 'recurring', label: 'Payments', icon: 'calendar_today', color: 'rose' },
        { id: 'loyalty', label: 'Wallet', icon: 'wallet', color: 'amber' },
    ];

    const segmentValues = useMemo(() => ({
        all: monthlySpend,
        recurring: monthlySpend,
        loyalty: memberships.length
    }), [monthlySpend, memberships.length]);

    const heroGradient = activeSegment === 'recurring'
        ? 'from-rose-500 via-rose-600 to-pink-700'
        : activeSegment === 'loyalty'
            ? 'from-amber-600 via-orange-600 to-yellow-600'
            : 'from-indigo-600 via-violet-700 to-purple-800';

    return (
        <div className="relative">
            <div className="relative z-10 space-y-6 pb-12 animate-fade-in-up">
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

                {/* --- Consolidated Header & Portfolio --- */}
                <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden relative group">
                    <div className={`absolute -top-24 -right-24 w-64 h-64 blur-3xl opacity-20 transition-colors duration-1000 bg-gradient-to-br ${heroGradient}`} />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-8 flex-1">
                            <div onClick={() => setActiveSegment('all')} className="cursor-pointer group/nw">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary-500 text-sm">autorenew</span>
                                    <span className="text-[10px] font-semibold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Monthly Commitment</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-4xl font-bold tracking-tight privacy-blur text-light-text dark:text-dark-text group-hover/nw:text-primary-500 transition-colors">
                                        {formatCurrency(monthlySpend, 'EUR')}
                                    </h2>
                                    {activeSegment === 'all' && (
                                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2 opacity-60">
                                     <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.1em]">{formatCurrency(yearlySpend, 'EUR')} / Year</span>
                                </div>
                            </div>

                            <div className="hidden lg:block w-px h-16 bg-black/5 dark:bg-white/10" />

                            {/* Segment Grid - High Density Tiles */}
                            <div className="flex-[2] grid grid-cols-2 sm:grid-cols-2 gap-4">
                                {segments.filter(s => s.id !== 'all').map(seg => {
                                    const isActive = activeSegment === seg.id;
                                    const val = segmentValues[seg.id as keyof typeof segmentValues];
                                    const isPrice = seg.id === 'recurring';
                                    return (
                                        <div key={seg.id} onClick={() => setActiveSegment(seg.id)} className={`group cursor-pointer p-4 rounded-2xl transition-all border ${isActive ? 'bg-primary-500/5 border-primary-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary-500/10 text-primary-500' : 'bg-gray-100 dark:bg-white/5 text-light-text-secondary'}`}>
                                                    <span className="material-symbols-outlined text-lg">{seg.icon}</span>
                                                </div>
                                                {isActive && <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-semibold tracking-wider ${isActive ? 'text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{seg.label}</span>
                                                <span className={`text-lg font-bold tracking-tight privacy-blur ${isActive ? 'text-light-text dark:text-dark-text' : 'text-light-text-secondary group-hover:text-light-text dark:group-hover:text-dark-text'}`}>
                                                    {isPrice ? formatCurrency(val, 'EUR') : val}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Main Action */}
                        <div className="shrink-0 flex gap-3">
                             {activeSegment === 'loyalty' ? (
                                <button onClick={handleAddMembership} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 group/add animate-glow`}>
                                    <span className="material-symbols-outlined text-xl transition-transform group-hover/add:rotate-90">add</span>
                                    <span>Add Card</span>
                                </button>
                             ) : (
                                <button onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2 group/add animate-glow`}>
                                    <span className="material-symbols-outlined text-xl transition-transform group-hover/add:rotate-90">add</span>
                                    <span>New Service</span>
                                </button>
                             )}
                        </div>
                    </div>

                    {/* Integrated Details Tray */}
                    <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-6">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeSegment} initial={{ opacity: 0, x: -1 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 1 }} className="flex flex-wrap items-center gap-x-12 gap-y-3">
                                {activeSegment === 'loyalty' ? (
                                     <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/5 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-base text-amber-500/70">timer</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70 uppercase">Expiring 30d</span>
                                                <span className="text-sm font-black text-light-text dark:text-dark-text">{expiringMemberships}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/5 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-base text-blue-500/70">category</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70 uppercase">Categories</span>
                                                <span className="text-sm font-black text-light-text dark:text-dark-text">{sortedMembershipCategories.length}</span>
                                            </div>
                                        </div>
                                     </>
                                ) : (
                                     <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-rose-500/5 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-base text-rose-500/70">event_upcoming</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70 uppercase">Next 7 Days</span>
                                                <span className="text-sm font-black text-light-text dark:text-dark-text">{dueSoonCount}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/5 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-base text-indigo-500/70">subscriptions</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black tracking-widest text-light-text-secondary/70 uppercase">Active Subscriptions</span>
                                                <span className="text-sm font-black text-light-text dark:text-dark-text">{totalCount}</span>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-3">
                                             <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                {Array.from({ length: 31 }).map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`w-1.5 h-1.5 rounded-full transition-all ${subscriptionDays.has(i + 1) ? 'bg-primary-500 shadow-[0_0_4px_rgba(99,102,241,0.8)]' : 'bg-black/5 dark:bg-white/5'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                     </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {(activeSegment === 'all' || activeSegment === 'recurring') && (
                        <motion.div key="recurring" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                            {detectedSubscriptions.length > 0 && activeSegment !== 'recurring' && (
                                <motion.div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-primary-700 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10">
                                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-[100px] pointer-events-none" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-6 bg-white/10 w-fit px-4 py-1.5 rounded-full backdrop-blur-xl border border-white/20">
                                            <span className="material-symbols-outlined text-sm text-yellow-300">verified</span>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Smart Detection</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {detectedSubscriptions.map((sub) => {
                                                const logoUrl = getMerchantLogoUrl(sub.merchant, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                                const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                                return (
                                                    <div key={sub.key} className="bg-white/10 backdrop-blur-2xl px-5 py-4 rounded-3xl border border-white/10 flex flex-col justify-between group hover:bg-white/20 transition-all">
                                                        <div className="flex items-start justify-between gap-4 mb-4">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/20 shadow-xl ${hasLogo ? 'bg-white' : 'bg-white/10'}`}>
                                                                    {hasLogo ? (<img src={logoUrl!} alt="" className="w-full h-full object-contain" onError={() => handleLogoError(logoUrl!)} />) : (<span className="text-lg font-black text-white/40">{sub.merchant.charAt(0).toUpperCase()}</span>)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 className="text-white font-black text-sm tracking-tight truncate leading-none mb-1">{sub.merchant}</h4>
                                                                    <span className="text-[9px] font-black uppercase text-white/50 tracking-widest">{sub.frequency}</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-base font-black text-white tracking-tighter">{formatCurrency(sub.amount, sub.currency)}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleIgnore(sub.key)} className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white/100 hover:bg-white/10 rounded-lg">Ignore</button>
                                                            <button onClick={() => handleTrack(sub)} className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest bg-white text-indigo-700 rounded-lg shadow-lg">Track</button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-sm">
                                <div className="flex items-center justify-between pb-6 border-b border-black/5 dark:border-white/5 mb-6">
                                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">
                                         <span className="material-symbols-outlined text-primary-500">subscriptions</span>
                                         <span>Active Subscriptions</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {activeSubscriptions.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-light-text-secondary dark:text-dark-text-secondary/40 font-medium">No active services found.</div>
                                    ) : (
                                        activeSubscriptions.map((sub) => {
                                            const nextDueDate = parseLocalDate(sub.nextDueDate);
                                            const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                            const isDueSoon = daysUntil >= 0 && daysUntil <= 3;
                                            const isOverdue = daysUntil < 0;
                                            const merchantName = sub.merchant || sub.description;
                                            const logoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                            const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                            
                                            return (
                                                <div 
                                                    key={sub.id} 
                                                    onClick={() => handleEditActive(sub)}
                                                    className="group cursor-pointer bg-light-fill dark:bg-dark-fill/40 rounded-3xl p-5 border border-transparent hover:border-primary-500/20 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                                                >
                                                     {/* Inner Glow Effect */}
                                                    <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden" style={{ background: `radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)`, opacity: 0.5 }} />

                                                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 ${hasLogo ? 'bg-white shadow-sm' : 'bg-gray-200 dark:bg-white/10'}`}>
                                                                    {hasLogo ? (<img src={logoUrl!} alt="" className="w-8 h-8 object-contain" onError={() => handleLogoError(logoUrl!)} />) : (<span className="text-xl font-black text-gray-400 truncate">{merchantName.charAt(0)}</span>)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 className="font-bold text-lg text-light-text dark:text-dark-text truncate leading-tight uppercase tracking-tight">{merchantName}</h4>
                                                                    <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase opacity-60">{sub.frequency}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-black text-xl text-light-text dark:text-dark-text tracking-tighter tabular-nums">{formatCurrency(sub.amount, sub.currency)}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-rose-500 animate-pulse' : isDueSoon ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                                                                <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.1em]">
                                                                    {isOverdue ? 'Overdue' : isDueSoon ? `${daysUntil}d left` : `Due ${nextDueDate.toLocaleDateString()}`}
                                                                </span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteActive(sub.id); }}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-light-text-secondary/40"
                                                            >
                                                                <span className="material-symbols-outlined text-base">delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {(activeSegment === 'all' || activeSegment === 'loyalty') && (
                        <motion.div key="loyalty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
                             {memberships.length > 0 ? (
                                <div className="space-y-10">
                                    {sortedMembershipCategories.map(category => {
                                        const cards = groupedMemberships[category];
                                        return (
                                            <div key={category} className="space-y-6">
                                                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                                                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                                        {category}
                                                        <span className="px-2 py-0.5 rounded-full bg-light-fill dark:bg-dark-fill text-[9px] font-black">{cards.length}</span>
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
                                <div className="py-24 text-center bg-white dark:bg-dark-card rounded-[3rem] border border-black/5 dark:border-white/5 border-dashed">
                                    <div className="w-20 h-20 bg-light-fill dark:bg-dark-fill rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300 dark:text-gray-700 shadow-inner">
                                        <span className="material-symbols-outlined text-4xl">loyalty</span>
                                    </div>
                                    <h3 className="text-lg font-black text-light-text dark:text-dark-text tracking-tighter">Your wallet is empty</h3>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs mx-auto mt-2 font-medium">Keep your cards and programs in one place.</p>
                                    <button onClick={handleAddMembership} className={`${BTN_PRIMARY_STYLE} mt-8`}>Add Card</button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Subscriptions;
