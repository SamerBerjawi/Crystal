
import React, { useState, useMemo, useEffect } from 'react';
import { RecurringTransaction, Transaction, RecurrenceFrequency, Currency, Membership } from '../types';
import { formatCurrency, convertToEur, parseLocalDate, toLocalISOString } from '../utils';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE } from '../constants';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import MembershipModal from '../components/MembershipModal';
import LoyaltyCard from '../components/LoyaltyCard';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useScheduleContext, useCategoryContext } from '../contexts/FinancialDataContext';
import PageHeader from '../components/PageHeader';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

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

    const { monthlySpend, yearlySpend, subscriptionCount, dueSoonCount } = useMemo(() => {
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
        return { monthlySpend: monthly, yearlySpend: monthly * 12, subscriptionCount: activeSubscriptions.length, dueSoonCount: dueSoon };
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
                markerLabel="Recurring Center"
                title="Subscriptions & Loyalty"
                subtitle="Manage your recurring commitments and membership rewards in one place."
                actions={
                     activeTab === 'recurring' ? (
                        <button onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                            <span className="material-symbols-outlined text-lg">add</span> Add
                        </button>
                     ) : (
                        <button onClick={handleAddMembership} className={`${BTN_PRIMARY_STYLE} flex items-center gap-2`}>
                             <span className="material-symbols-outlined text-lg">add</span> Add Card
                        </button>
                     )
                }
            />
            
            {/* View Toggle */}
            <div className="flex justify-center">
                 <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('recurring')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'recurring' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        Recurring Payments
                    </button>
                    <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'loyalty' ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        Loyalty Wallet
                    </button>
                </div>
            </div>

            {/* Recurring Payments Content */}
            {activeTab === 'recurring' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Detection Alert */}
                    {detectedSubscriptions.length > 0 && (
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white dark:bg-white/10 rounded-full shadow-sm">
                                    <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Detected Subscriptions</h2>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">We found {detectedSubscriptions.length} recurring charges in your transactions.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {detectedSubscriptions.map(sub => {
                                    const logoUrl = getMerchantLogoUrl(sub.merchant, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                    const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                    const initial = sub.merchant.charAt(0).toUpperCase();

                                    return (
                                        <div key={sub.key} className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5 flex flex-col justify-between hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white' : 'bg-gray-100 dark:bg-white/10'}`}>
                                                        {hasLogo ? (
                                                            <img 
                                                                src={logoUrl!} 
                                                                alt={sub.merchant} 
                                                                className="w-full h-full object-cover block" 
                                                                onError={() => handleLogoError(logoUrl!)}
                                                            />
                                                        ) : (
                                                            <span className="text-lg font-bold text-gray-500 dark:text-gray-400">{initial}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-light-text dark:text-dark-text truncate" title={sub.merchant}>{sub.merchant}</h3>
                                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1 mt-0.5">
                                                            <span className="capitalize">{sub.frequency}</span>
                                                            <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                                                            <span>~{sub.averageDay}{[1, 21, 31].includes(sub.averageDay) ? 'st' : [2, 22].includes(sub.averageDay) ? 'nd' : [3, 23].includes(sub.averageDay) ? 'rd' : 'th'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end flex-shrink-0">
                                                        <span className="font-bold font-mono text-light-text dark:text-dark-text">{formatCurrency(sub.amount, sub.currency)}</span>
                                                        <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded uppercase font-bold mt-1">Detected</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 mt-auto pt-3 border-t border-black/5 dark:border-white/5">
                                                <button onClick={() => handleIgnore(sub.key)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Ignore</button>
                                                <button onClick={() => handleTrack(sub)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm">Track</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* Hero Grid: Calendar & Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Calendar Card */}
                        <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Payment Cycle</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Distribution of recurring charges across the month</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">Due Day</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-y-3 gap-x-1 sm:gap-x-2 place-items-center mt-2">
                                {Array.from({length: 31}).map((_, i) => {
                                    const day = i + 1;
                                    const isActive = subscriptionDays.has(day);
                                    const isToday = new Date().getDate() === day;
                                    
                                    return (
                                        <div 
                                        key={i} 
                                        className={`
                                            w-8 h-8 flex items-center justify-center text-xs font-medium rounded-full transition-all duration-300 relative
                                            ${isActive 
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-110 font-bold' 
                                                : 'text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-text dark:hover:text-dark-text'
                                            }
                                            ${isToday ? 'ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-dark-card z-10' : ''}
                                        `}
                                        >
                                            {day}
                                            {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-white/60 rounded-full"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Metrics Column */}
                        <div className="flex flex-col gap-4">
                            <div className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg flex flex-col justify-between">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <span className="material-symbols-outlined text-6xl">payments</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase opacity-80 tracking-wider mb-1">Monthly Cost</p>
                                    <p className="text-3xl font-black">{formatCurrency(monthlySpend, 'EUR')}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <p className="text-xs font-medium opacity-90 flex justify-between">
                                        <span>Annual Estimate</span>
                                        <span className="font-bold">{formatCurrency(yearlySpend, 'EUR')}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-dark-card rounded-2xl p-5 border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Renewing Soon</p>
                                    <span className="material-symbols-outlined text-orange-500 text-xl">event_upcoming</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                     <p className="text-3xl font-black text-light-text dark:text-dark-text">{dueSoonCount}</p>
                                     <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">items</span>
                                </div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Due in next 7 days</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Full Width List */}
                    <Card className="p-0 overflow-hidden">
                        <div className="divide-y divide-black/5 dark:divide-white/5">
                            {activeSubscriptions.length === 0 ? (
                                <div className="p-12 text-center text-light-text-secondary dark:text-dark-text-secondary italic">
                                    No active subscriptions.
                                </div>
                            ) : (
                                activeSubscriptions.map(sub => {
                                    const nextDueDate = parseLocalDate(sub.nextDueDate);
                                    const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    const isDueSoon = daysUntil >= 0 && daysUntil <= 7;
                                    
                                    const merchantName = sub.merchant || sub.description;
                                    const logoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                    const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                    const initial = merchantName.charAt(0).toUpperCase();

                                    // Calculate cycle progress (approximate)
                                    let cycleLength = 30;
                                    if (sub.frequency === 'weekly') cycleLength = 7;
                                    if (sub.frequency === 'yearly') cycleLength = 365;
                                    const daysElapsed = cycleLength - daysUntil;
                                    const progress = Math.max(0, Math.min(100, (daysElapsed / cycleLength) * 100));

                                    return (
                                        <div key={sub.id} className="group p-4 sm:px-6 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-4">
                                            {/* Logo */}
                                            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm border border-black/5 dark:border-white/10 ${hasLogo ? 'bg-white' : 'bg-gray-100 dark:bg-white/10'}`}>
                                                {hasLogo ? (
                                                    <img 
                                                        src={logoUrl!} 
                                                        alt={merchantName} 
                                                        className="w-full h-full object-cover block" 
                                                        onError={() => handleLogoError(logoUrl!)}
                                                    />
                                                ) : (
                                                    <span className="text-xl font-bold text-gray-500 dark:text-gray-400">{initial}</span>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-grow min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-base text-light-text dark:text-dark-text truncate">{sub.merchant || sub.description}</h4>
                                                        <span className="text-[10px] font-bold uppercase bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary px-2 py-0.5 rounded">{sub.frequency}</span>
                                                    </div>
                                                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                                         {sub.description !== sub.merchant ? sub.description : accounts.find(a => a.id === sub.accountId)?.name}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col justify-center gap-1 sm:pl-4">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className={`font-medium ${isDueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                                            {isDueSoon ? `Due in ${daysUntil} days` : `Due ${nextDueDate.toLocaleDateString()}`}
                                                        </span>
                                                        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">Cycle</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${isDueSoon ? 'bg-orange-500' : 'bg-primary-500'}`} style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Amount & Actions */}
                                            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1 ml-2">
                                                <span className="font-mono font-bold text-lg text-light-text dark:text-dark-text">{formatCurrency(sub.amount, sub.currency)}</span>
                                                
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditActive(sub)} className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors" title="Edit">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteActive(sub.id)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors" title="Stop Tracking">
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Loyalty Wallet Content */}
            {activeTab === 'loyalty' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Metrics Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                         <div className="bg-white dark:bg-dark-card rounded-2xl p-5 border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-2xl">style</span>
                             </div>
                             <div>
                                 <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">Total Cards</p>
                                 <p className="font-black text-2xl text-light-text dark:text-dark-text">{memberships.length}</p>
                             </div>
                        </div>
                        <div className="bg-white dark:bg-dark-card rounded-2xl p-5 border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-2xl">timer</span>
                             </div>
                             <div>
                                 <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">Expiring Soon</p>
                                 <p className="font-black text-2xl text-light-text dark:text-dark-text">{expiringMemberships}</p>
                             </div>
                        </div>
                         {/* Placeholder metrics for future expansion */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl p-5 border border-black/5 dark:border-white/5 shadow-sm flex items-center gap-4 opacity-60">
                             <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-2xl">stars</span>
                             </div>
                             <div>
                                 <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">Total Points</p>
                                 <p className="font-black text-2xl text-light-text dark:text-dark-text">—</p>
                             </div>
                        </div>
                    </div>

                    {memberships.length > 0 ? (
                        <div className="space-y-8">
                            {sortedMembershipCategories.map(category => {
                                const cards = groupedMemberships[category];
                                return (
                                    <div key={category}>
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-4 pl-1 border-b border-black/5 dark:border-white/5 pb-2 flex justify-between">
                                            <span>{category}</span>
                                            <span className="opacity-60">{cards.length}</span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                         <div className="flex flex-col items-center justify-center py-20 text-center bg-light-card/50 dark:bg-dark-card/30 rounded-3xl border-2 border-dashed border-black/10 dark:border-white/10">
                             <span className="material-symbols-outlined text-6xl text-light-text-secondary dark:text-dark-text-secondary opacity-30 mb-4">loyalty</span>
                             <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Wallet Empty</h3>
                             <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs mt-2 mb-6">
                                 Keep your frequent flyer numbers, store cards, and reward programs handy.
                             </p>
                             <button onClick={handleAddMembership} className={BTN_PRIMARY_STYLE}>Add First Card</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Subscriptions;
