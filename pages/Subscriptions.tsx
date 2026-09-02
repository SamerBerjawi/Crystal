
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
import HeaderButton from '../components/HeaderButton';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { motion, AnimatePresence } from 'motion/react';
import { useConfirm } from '../components/ConfirmationModal';
import Icon from '../components/ui/Icon';
import { BentoCard, BentoGrid } from '../components/ui/bento-grid';
import { MobileSubscriptionsView } from '../components/MobileSubscriptionsView';
import { useIsMobile } from '../hooks/useIsMobile';

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
    if (!str) return '';
    // 1. Lowercase
    let clean = str.toLowerCase();
    
    // 2. Remove common transaction prefixes/gateway noise
    clean = clean.replace(/^(paypal\s*\*|stripe\s*\*|sq\s*\*|apple\s+bill\s*|google\s*\*|amzn\s*\*|amazon\s*\*|g\.co\/helppay#?)/g, '');
    
    // 3. Remove card numbers and ending details (e.g. *1234, x1234, ending in 1234)
    clean = clean.replace(/(ending\s+in\s+\d+|[\s*-]*[x*]+\d{2,4}\b)/g, '');
    
    // 4. Remove transaction reference codes and dates (e.g. #12345, 12-34, 20240401)
    clean = clean.replace(/(#[a-z0-9_-]+|\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\/\d{2}\/\d{4}\b|\b\d{8,}\b)/g, '');
    
    // 5. Remove common corporate suffixes at the end of words or strings
    clean = clean.replace(/\b(inc|llc|ltd|corp|gmbh|co|com|net|org|srl|sas|se|nl|de|fr|uk|holding|holdings|services|group|pay|payment|bill|billing|subscription|member|membership)\b/g, '');
    
    // 6. Keep only a-z and 0-9 to normalize
    clean = clean.replace(/[^a-z0-9]/g, '');
    
    return clean.trim();
};

const calculateFrequency = (intervals: number[]): RecurrenceFrequency | null => {
    if (intervals.length === 0) return null;
    
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // Standard deviation to ensure consistency
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Set variable tolerances based on subscription frequency average interval (in days)
    // - Daily: avg ~1 day, max stdDev = 0.5
    // - Weekly: avg ~7 days, max stdDev = 2.5 (allows 1-2 days weekend shifts)
    // - Monthly: avg ~30 days, max stdDev = 6.0 (allows variable month lengths + weekends)
    // - Yearly: avg ~365 days, max stdDev = 15.0
    let maxStdDev = 5;
    if (avg >= 0.8 && avg <= 1.5) maxStdDev = 0.5;
    else if (avg >= 5 && avg <= 9) maxStdDev = 2.5;
    else if (avg >= 25 && avg <= 35) maxStdDev = 6.0;
    else if (avg >= 355 && avg <= 375) maxStdDev = 15.0;

    if (stdDev > maxStdDev) return null;

    if (avg >= 0.8 && avg <= 1.5) return 'daily';
    if (avg >= 5.5 && avg <= 8.5) return 'weekly';
    if (avg >= 25 && avg <= 35) return 'monthly';
    if (avg >= 355 && avg <= 375) return 'yearly';
    
    return null;
};

type SubscriptionSegment = 'all' | 'recurring' | 'loyalty';

const Subscriptions: React.FC = () => {
    const isMobile = useIsMobile();
    const { transactions } = useTransactionsContext();
    const { accounts } = useAccountsContext();
    const { confirm, ConfirmDialog } = useConfirm();
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

            // Group by normalized merchant/description
            expenseTransactions.forEach(tx => {
                const targetStr = tx.merchant || tx.description;
                let key = normalizeString(targetStr);
                if (key.length < 3) {
                    // Fallback to simpler normalization of description if it was too aggressively cleaned
                    key = tx.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
                }
                if (key.length >= 3) {
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(tx);
                }
            });

            const candidates: DetectedSubscription[] = [];

            Object.entries(groups).forEach(([key, groupTxs]) => {
                // Need at least 2 occurrences to detect a pattern
                if (groupTxs.length < 2) return;

                // Check if already tracked or ignored
                const isTracked = recurringTransactions.some(rt => {
                    const rtStr = rt.merchant || rt.description;
                    let rtKey = normalizeString(rtStr);
                    if (rtKey.length < 3) {
                        rtKey = rt.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
                    }
                    return rtKey.includes(key) || key.includes(rtKey);
                });
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
                    
                    // Determine "confidence" based on consistency of amount and timing
                    const amountVariance = groupTxs.reduce((sum, t) => sum + Math.pow(Math.abs(t.amount) - avgAmount, 2), 0) / groupTxs.length;
                    const amountStdDev = Math.sqrt(amountVariance);
                    
                    const isAmountConsistent = amountStdDev <= (avgAmount * 0.05); // <=5% variation
                    const hasManyOccurrences = groupTxs.length >= 3;
                    
                    // Timing consistency check based on standard deviation of intervals
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const intervalVariance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
                    const intervalStdDev = Math.sqrt(intervalVariance);
                    const isTimingConsistent = intervalStdDev <= (frequency === 'weekly' ? 1.0 : frequency === 'monthly' ? 3.0 : 7.0);

                    const confidence = (isAmountConsistent && hasManyOccurrences && isTimingConsistent) ? 'high' : 'medium';

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

    const handleDeleteActive = async (id: string) => {
        const confirmed = await confirm({
            title: 'Stop Tracking Subscription?',
            message: 'This will remove the subscription from your tracked services. You can always re-add it later.',
            confirmLabel: 'Stop Tracking',
            variant: 'danger',
            icon: 'autorenew',
        });
        if (confirmed) deleteRecurringTransaction(id);
    };
    
    const handleSave = (data: Omit<RecurringTransaction, 'id'> & { id?: string }) => {
        saveRecurringTransaction(data);
        setIsModalOpen(false);
        // Remove from detected if it matches (cleanup)
        if (!data.id) {
             // Just added a new one, clear matching detected items immediately for UX
             const targetStr = data.merchant || data.description;
             let key = normalizeString(targetStr);
             if (key.length < 3) {
                 key = data.description.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
             }
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
    
    const handleDeleteMembershipRequest = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Membership Card?',
            message: 'This card will be permanently removed from your wallet.',
            confirmLabel: 'Delete',
            variant: 'danger',
            icon: 'refresh',
        });
        if (confirmed) deleteMembership(id);
    };

    const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

    const segments: { id: SubscriptionSegment; label: string; icon: string; count: number }[] = [
        { id: 'all', label: 'Overview', icon: 'layout_alt', count: totalCount + memberships.length },
        { id: 'recurring', label: 'Payments', icon: 'CreditCard01', count: totalCount },
        { id: 'loyalty', label: 'Wallet', icon: 'wallet', count: memberships.length },
    ];

    // Dynamic glow color for hero card based on active segment
    const heroGlowColor = activeSegment === 'recurring'
        ? 'rgba(244, 63, 94, 0.12)'
        : activeSegment === 'loyalty'
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(var(--primary-500-rgb), 0.12)';

    const heroAccentClass = activeSegment === 'recurring'
        ? 'text-rose-500'
        : activeSegment === 'loyalty'
            ? 'text-amber-500'
            : 'text-primary-500';

    return (
        <div className="relative">
            {/* Shared Modals for Mobile & Desktop */}
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

            {/* Responsive View Switch */}
            {isMobile ? (
                <MobileSubscriptionsView
                    subscriptions={activeSubscriptions}
                    totalMonthlyCost={monthlySpend}
                    totalAnnualCost={yearlySpend}
                    onAddSubscription={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }}
                    onEditSubscription={handleEditActive}
                    onDeleteSubscription={handleDeleteActive}
                />
            ) : (
                <div className="space-y-6 pb-12 animate-fade-in-up">

                <PageHeader 
                    markerIcon="refresh"
                    markerLabel="Subscriptions & Memberships"
                    title="Active Commitments"
                    subtitle="Track active digital products, recurring user contracts, gym memberships, and loyalty cards in a unified panel."
                    actions={
                        <div className="flex items-center gap-2">
                            {activeSegment === 'loyalty' ? (
                                <HeaderButton
                                    variant="primary"
                                    icon="PlusCircle"
                                    onClick={handleAddMembership}
                                >
                                    Add Card
                                </HeaderButton>
                            ) : (
                                <HeaderButton
                                    variant="primary"
                                    icon="PlusCircle"
                                    onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }}
                                >
                                    New Service
                                </HeaderButton>
                            )}
                        </div>
                    }
                />

                {/* ── Pill Segment Tab Bar ── */}
                <div className="flex items-center gap-1 p-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl w-fit border border-black/5 dark:border-white/5">
                    {segments.map(seg => {
                        const isActive = activeSegment === seg.id;
                        return (
                            <button
                                key={seg.id}
                                onClick={() => setActiveSegment(seg.id)}
                                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
                                    isActive 
                                        ? 'text-white' 
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="segment-pill"
                                        className="absolute inset-0 bg-primary-600 dark:bg-primary-500 rounded-xl shadow-md shadow-primary-600/20"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <Icon name={seg.icon} className="text-sm" />
                                    <span>{seg.label}</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums leading-none ${
                                        isActive 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-black/5 dark:bg-white/5 text-light-text-secondary/70 dark:text-dark-text-secondary/70'
                                    }`}>
                                        {seg.count}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Glassmorphic Hero Metrics Bento Card ── */}
                <BentoCard 
                    className="!p-0 min-h-[220px]"
                    background={
                        <>
                            <div 
                                className="absolute -top-32 -right-32 w-80 h-80 blur-[100px] pointer-events-none transition-all duration-1000"
                                style={{ background: heroGlowColor }}
                            />
                            <div 
                                className="absolute -bottom-24 -left-24 w-56 h-56 blur-[80px] pointer-events-none transition-all duration-1000 opacity-50"
                                style={{ background: heroGlowColor }}
                            />
                        </>
                    }
                >
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        {/* Primary Metric */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon name="autorenew" className={`text-sm ${heroAccentClass}`} />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Monthly Commitment</span>
                                </div>
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight privacy-blur text-light-text dark:text-dark-text">
                                        {formatCurrency(monthlySpend, 'EUR')}
                                    </h2>
                                    <span className="text-sm font-semibold text-light-text-secondary/50 dark:text-dark-text-secondary/50 tracking-tight">/mo</span>
                                </div>
                                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-50 mt-1.5 tracking-tight privacy-blur">
                                    {formatCurrency(yearlySpend, 'EUR')} projected annually
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <BentoGrid className="grid-cols-2 sm:grid-cols-4 auto-rows-auto gap-4 pt-6 border-t border-black/5 dark:border-white/5">
                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={activeSegment}
                                    initial={{ opacity: 0, y: 4 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2 }}
                                    className="contents"
                                >
                                    {activeSegment === 'loyalty' ? (
                                        <>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/[0.04] dark:bg-amber-500/[0.03]">
                                                <Icon name="wallet" className="text-lg text-amber-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Total Cards</span>
                                                    <span className="text-lg font-bold text-light-text dark:text-dark-text tabular-nums">{memberships.length}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-500/[0.04] dark:bg-orange-500/[0.03]">
                                                <Icon name="timer" className="text-lg text-orange-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Expiring 30d</span>
                                                    <span className="text-lg font-bold text-light-text dark:text-dark-text tabular-nums">{expiringMemberships}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary-500/[0.04] dark:bg-primary-500/[0.03]">
                                                <Icon name="category" className="text-lg text-primary-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Categories</span>
                                                    <span className="text-lg font-bold text-light-text dark:text-dark-text tabular-nums">{sortedMembershipCategories.length}</span>
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/[0.04] dark:bg-emerald-500/[0.03]">
                                                <Icon name="loyalty" className="text-lg text-emerald-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Active</span>
                                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{memberships.length - expiringMemberships}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-500/[0.04] dark:bg-rose-500/[0.03]">
                                                <Icon name="event_upcoming" className="text-lg text-rose-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Due 7 Days</span>
                                                    <span className="text-lg font-bold text-light-text dark:text-dark-text tabular-nums">{dueSoonCount}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary-500/[0.04] dark:bg-primary-500/[0.03]">
                                                <Icon name="subscriptions" className="text-lg text-primary-500 shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Active</span>
                                                    <span className="text-lg font-bold text-light-text dark:text-dark-text tabular-nums">{totalCount}</span>
                                                </div>
                                            </div>
                                            {detectedSubscriptions.length > 0 && (
                                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/[0.04] dark:bg-amber-500/[0.03]">
                                                    <div className="relative shrink-0">
                                                        <Icon name="radar" className="text-lg text-amber-500" />
                                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse border-2 border-white dark:border-dark-card" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Detected</span>
                                                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{detectedSubscriptions.length}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="hidden sm:flex items-center gap-3 p-3 rounded-2xl">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary/60 dark:text-dark-text-secondary/60">Calendar</span>
                                                    <div className="flex flex-wrap gap-[3px] max-w-[140px]">
                                                        {Array.from({ length: 31 }).map((_, i) => (
                                                            <div 
                                                                key={i} 
                                                                className={`w-2 h-2 rounded-sm transition-all ${subscriptionDays.has(i + 1) ? 'bg-primary-500 shadow-[0_0_4px_rgba(var(--primary-500-rgb),0.6)]' : 'bg-black/[0.04] dark:bg-white/[0.04]'}`}
                                                                title={`Day ${i + 1}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </BentoGrid>
                    </div>
                </BentoCard>

                <div className="space-y-8">
                    <AnimatePresence mode="wait">
                    {/* ── Main Subscriptions Views ── */}
                    {activeSegment !== 'loyalty' && (
                        <motion.div 
                            key="services" 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }} 
                            transition={{ duration: 0.25 }} 
                            className="space-y-8"
                        >
                            
                            {/* ── Smart Detection Section ── */}
                            {detectedSubscriptions.length > 0 && activeSegment !== 'recurring' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-dark-card rounded-3xl border border-primary-500/20 dark:border-primary-400/10 overflow-hidden relative"
                                >
                                    {/* Gradient accent bar */}
                                    <div className="h-1 bg-gradient-to-r from-primary-500 via-violet-500 to-primary-600" />
                                    
                                    {/* Ambient glow */}
                                    <div className="absolute -top-20 right-0 w-60 h-60 blur-[80px] bg-primary-500/10 pointer-events-none" />
                                    
                                    <div className="relative z-10 p-6 md:p-8">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <Icon name="radar" className="text-lg text-primary-500" />
                                                    <span className="absolute inset-0 rounded-xl border border-primary-500/30 animate-ping opacity-30" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight">Smart Detection</h3>
                                                    <p className="text-xs font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                                                        {detectedSubscriptions.length} potential subscription{detectedSubscriptions.length !== 1 ? 's' : ''} found
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {detectedSubscriptions.map((sub, index) => {
                                                const logoUrl = getMerchantLogoUrl(sub.merchant, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                                const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                                return (
                                                    <motion.div 
                                                        key={sub.key}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        className="group flex flex-col justify-between bg-light-fill/60 dark:bg-dark-fill/40 rounded-2xl p-4 border border-black/5 dark:border-white/5 hover:border-primary-500/20 hover:shadow-lg transition-all duration-300"
                                                    >
                                                        <div className="flex items-start justify-between gap-3 mb-4">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center overflow-hidden ring-2 ring-black/5 dark:ring-white/5 ${hasLogo ? 'bg-white dark:bg-white/10' : 'bg-primary-500/10'}`}>
                                                                    {hasLogo ? (
                                                                        <img src={logoUrl!} alt="" className="w-full h-full object-cover" onError={() => handleLogoError(logoUrl!)} />
                                                                    ) : (
                                                                        <span className="text-base font-bold text-primary-500">{sub.merchant.charAt(0).toUpperCase()}</span>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h4 className="font-bold text-sm text-light-text dark:text-dark-text truncate leading-tight tracking-tight">{sub.merchant}</h4>
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold tracking-wide ${
                                                                            sub.confidence === 'high' 
                                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                        }`}>
                                                                            {sub.confidence}
                                                                        </span>
                                                                        <span className="text-xs font-semibold text-light-text-secondary/50 dark:text-dark-text-secondary/50">{sub.frequency}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p className="text-base font-bold text-light-text dark:text-dark-text tracking-tighter tabular-nums shrink-0 privacy-blur">{formatCurrency(sub.amount, sub.currency)}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleIgnore(sub.key)} 
                                                                className="flex-1 h-8 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-[0.98]"
                                                            >
                                                                Ignore
                                                            </button>
                                                            <button 
                                                                onClick={() => handleTrack(sub)} 
                                                                className="flex-1 h-8 text-xs font-semibold bg-primary-600 dark:bg-primary-500 text-white rounded-lg shadow-sm shadow-primary-600/20 hover:bg-primary-500 dark:hover:bg-primary-400 transition-all active:scale-[0.98]"
                                                            >
                                                                Track
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── Active Subscriptions Grid ── */}
                            <div className="bg-white dark:bg-dark-card rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-6 md:px-8 md:pt-8 pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center">
                                            <Icon name="subscriptions" className="text-base text-primary-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight">Active Subscriptions</h3>
                                            <p className="text-xs font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/60">{totalCount} service{totalCount !== 1 ? 's' : ''} tracked</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-6 md:p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {activeSubscriptions.length === 0 ? (
                                            <div className="col-span-full py-16 text-center">
                                                <Icon name="subscriptions" className="text-4xl text-light-text-secondary/30 dark:text-dark-text-secondary/30 block mx-auto mb-4" />
                                                <h4 className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight mb-1">No active services</h4>
                                                <p className="text-xs text-light-text-secondary/50 dark:text-dark-text-secondary/50 mb-6">Add your first subscription to start tracking.</p>
                                                <HeaderButton variant="primary" icon="add" onClick={() => { setSubscriptionToEdit(null); setIsModalOpen(true); }}>
                                                    New Service
                                                </HeaderButton>
                                            </div>
                                        ) : (
                                            activeSubscriptions.map((sub, index) => {
                                                const nextDueDate = parseLocalDate(sub.nextDueDate);
                                                const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                const isDueSoon = daysUntil >= 0 && daysUntil <= 3;
                                                const isOverdue = daysUntil < 0;
                                                const merchantName = sub.merchant || sub.description;
                                                const logoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, merchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 64, height: 64 });
                                                const hasLogo = Boolean(logoUrl && !logoLoadErrors[logoUrl!]);
                                                
                                                const statusColor = isOverdue ? 'rose' : isDueSoon ? 'amber' : 'emerald';
                                                const statusLabel = isOverdue ? 'Overdue' : isDueSoon ? `${daysUntil}d left` : `Due ${nextDueDate.toLocaleDateString()}`;
                                                
                                                // Use inline styles for dynamic status colors since Tailwind can't handle string interpolation
                                                const statusDotStyle: React.CSSProperties = {
                                                    backgroundColor: isOverdue ? 'rgb(244, 63, 94)' : isDueSoon ? 'rgb(245, 158, 11)' : 'rgb(16, 185, 129)',
                                                    boxShadow: `0 0 6px ${isOverdue ? 'rgba(244, 63, 94, 0.4)' : isDueSoon ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                                };
                                                const accentBarStyle: React.CSSProperties = {
                                                    backgroundColor: isOverdue ? 'rgb(244, 63, 94)' : isDueSoon ? 'rgb(245, 158, 11)' : 'rgb(16, 185, 129)',
                                                };
                                                
                                                return (
                                                    <motion.div 
                                                        key={sub.id}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.03, duration: 0.3 }}
                                                        onClick={() => handleEditActive(sub)}
                                                        className="group cursor-pointer relative bg-light-fill/50 dark:bg-dark-fill/30 rounded-2xl border border-black/[0.03] dark:border-white/[0.03] hover:border-primary-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                                                    >
                                                        {/* Left accent bar */}
                                                        <div 
                                                            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all group-hover:top-2 group-hover:bottom-2"
                                                            style={accentBarStyle}
                                                        />
                                                        
                                                        <div className="p-4 pl-5 flex flex-col h-full justify-between gap-4">
                                                            {/* Top: Logo + Name + Amount */}
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-black/5 dark:ring-white/5 ${hasLogo ? 'bg-white dark:bg-white/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                                                                        {hasLogo ? (
                                                                            <img src={logoUrl!} alt="" className="w-full h-full object-cover" onError={() => handleLogoError(logoUrl!)} />
                                                                        ) : (
                                                                            <span className="text-lg font-bold text-gray-400 dark:text-gray-500">{merchantName.charAt(0)}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="font-bold text-sm text-light-text dark:text-dark-text truncate leading-tight tracking-tight">{merchantName}</h4>
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold tracking-wide mt-1 bg-black/[0.03] dark:bg-white/[0.04] text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                                                                            {sub.frequency}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <p className="font-bold text-lg text-light-text dark:text-dark-text tracking-tighter tabular-nums shrink-0 privacy-blur">{formatCurrency(sub.amount, sub.currency)}</p>
                                                            </div>

                                                            {/* Bottom: Status + Delete */}
                                                            <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
                                                                <div className="flex items-center gap-2">
                                                                    <span 
                                                                        className={`w-2 h-2 rounded-full ${isOverdue ? 'animate-pulse' : ''}`}
                                                                        style={statusDotStyle}
                                                                    />
                                                                    <span className="text-xs font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/60 tracking-wide">
                                                                        {statusLabel}
                                                                    </span>
                                                                </div>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteActive(sub.id); }}
                                                                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-light-text-secondary/30 active:scale-[0.95]"
                                                                >
                                                                    <Icon name="delete" className="text-sm" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Membership Views ── */}
                    {activeSegment !== 'recurring' && (
                        <motion.div key="loyalty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-8">
                             {memberships.length > 0 ? (
                                <div className="space-y-8">
                                    {sortedMembershipCategories.map((category, catIndex) => {
                                        const cards = groupedMemberships[category];
                                        return (
                                            <motion.div 
                                                key={category} 
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: catIndex * 0.08 }}
                                                className="space-y-5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <h4 className="text-xs font-bold tracking-[0.15em] uppercase text-light-text-secondary dark:text-dark-text-secondary">
                                                        {category}
                                                    </h4>
                                                    <span className="px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold tabular-nums">
                                                        {cards.length}
                                                    </span>
                                                    <div className="flex-1 h-px bg-black/5 dark:bg-white/5" />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                    {cards.map((m, i) => (
                                                        <motion.div
                                                            key={m.id}
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.04 }}
                                                        >
                                                            <LoyaltyCard 
                                                                membership={m}
                                                                onEdit={handleEditMembership}
                                                                onDelete={handleDeleteMembershipRequest}
                                                            />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-20 text-center bg-white dark:bg-dark-card rounded-3xl border border-dashed border-black/10 dark:border-white/10">
                                    <motion.div 
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', stiffness: 200 }}
                                        className="w-20 h-20 bg-light-fill dark:bg-dark-fill rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"
                                    >
                                        <Icon name="loyalty" className="text-4xl text-light-text-secondary/20 dark:text-dark-text-secondary/20" />
                                    </motion.div>
                                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight">Your wallet is empty</h3>
                                    <p className="text-sm text-light-text-secondary/60 dark:text-dark-text-secondary/60 max-w-xs mx-auto mt-2 font-medium leading-relaxed">
                                        Keep your membership cards and loyalty programs in one place.
                                    </p>
                                    <div className="mt-8">
                                        <HeaderButton variant="primary" icon="add" onClick={handleAddMembership}>
                                            Add Card
                                        </HeaderButton>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
                </div>
            </div>
            )}
            <ConfirmDialog />
        </div>
    );
};

export default Subscriptions;
