
import React, { useState, useMemo, useEffect } from 'react';
import { RecurringTransaction, Transaction, RecurrenceFrequency, Currency, LoyaltyProgram } from '../types';
import { formatCurrency, convertToEur, parseDateAsUTC } from '../utils';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE } from '../constants';
import RecurringTransactionModal from '../components/RecurringTransactionModal';
import LoyaltyProgramModal from '../components/LoyaltyProgramModal';
import useLocalStorage from '../hooks/useLocalStorage';
import { useAccountsContext, useTransactionsContext } from '../contexts/DomainProviders';
import { useScheduleContext, useCategoryContext } from '../contexts/FinancialDataContext';

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

const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    }
};

const LoyaltyCard: React.FC<{ program: LoyaltyProgram; onClick: () => void }> = ({ program, onClick }) => {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        copyToClipboard(program.membershipId);
    };

    const handleVisit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (program.websiteUrl) window.open(program.websiteUrl, '_blank');
    };

    // Calculate expiry status
    const isExpiring = useMemo(() => {
        if (!program.expiryDate) return false;
        const expiry = new Date(program.expiryDate);
        const today = new Date();
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 90; // Expiring in next 90 days
    }, [program.expiryDate]);

    return (
        <div 
            onClick={onClick}
            className="group relative h-56 rounded-2xl shadow-lg overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between text-white"
            style={{ backgroundColor: program.color }}
        >
            {/* Background Texture */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none mix-blend-overlay"></div>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 p-5 flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                        <span className="material-symbols-outlined text-xl">{program.icon || 'loyalty'}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight drop-shadow-sm">{program.name}</h3>
                        <p className="text-xs font-medium opacity-90">{program.programName}</p>
                    </div>
                </div>
                {program.tier && (
                    <span className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider shadow-sm">
                        {program.tier}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="relative z-10 px-5 flex-grow flex flex-col justify-center">
                 <div className="flex items-center gap-2 group/id">
                    <p className="font-mono text-xl tracking-widest opacity-95 drop-shadow-sm">{program.membershipId}</p>
                    <button 
                        onClick={handleCopy}
                        className="opacity-0 group-hover/id:opacity-100 transition-opacity p-1.5 hover:bg-white/20 rounded-lg active:scale-95"
                        title="Copy ID"
                    >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                 </div>
                 <p className="text-[10px] uppercase opacity-60 mt-1 font-medium tracking-wide">Membership ID</p>
            </div>

            {/* Footer */}
            <div className="relative z-10 p-5 pt-0 flex justify-between items-end">
                <div>
                    <p className="text-3xl font-bold leading-none">{program.pointsBalance.toLocaleString()}</p>
                    <p className="text-xs font-medium opacity-80 mt-1 uppercase tracking-wider">{program.pointsUnit}</p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                     {program.expiryDate && (
                        <div className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${isExpiring ? 'bg-red-500 text-white' : 'bg-black/20 text-white/90'}`}>
                            {isExpiring && <span className="material-symbols-outlined text-[10px]">warning</span>}
                            Exp: {new Date(program.expiryDate).toLocaleDateString(undefined, {month: 'short', year: '2-digit'})}
                        </div>
                    )}
                    {program.websiteUrl && (
                        <button 
                            onClick={handleVisit}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-colors border border-white/10 shadow-sm active:scale-95"
                            title="Visit Website"
                        >
                            <span className="material-symbols-outlined text-lg">open_in_new</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const Subscriptions: React.FC = () => {
    const { transactions } = useTransactionsContext();
    const { accounts } = useAccountsContext();
    const { recurringTransactions, saveRecurringTransaction, deleteRecurringTransaction, loyaltyPrograms, saveLoyaltyProgram, deleteLoyaltyProgram } = useScheduleContext();
    const { incomeCategories, expenseCategories } = useCategoryContext();
    
    const [activeTab, setActiveTab] = useState<'recurring' | 'loyalty'>('recurring');

    const [ignoredSubscriptions, setIgnoredSubscriptions] = useLocalStorage<string[]>('ignored-subscriptions', []);
    const [detectedSubscriptions, setDetectedSubscriptions] = useState<DetectedSubscription[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
    const [subscriptionToEdit, setSubscriptionToEdit] = useState<(Omit<RecurringTransaction, 'id'> & { id?: string }) | null>(null);
    const [loyaltyProgramToEdit, setLoyaltyProgramToEdit] = useState<LoyaltyProgram | null>(null);

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
    
    // --- 3. Loyalty Stats ---
    const loyaltyStats = useMemo(() => {
        const total = loyaltyPrograms.length;
        const expiringSoon = loyaltyPrograms.filter(p => {
             if (!p.expiryDate) return false;
             const expiry = new Date(p.expiryDate);
             const today = new Date();
             const diffTime = expiry.getTime() - today.getTime();
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
             return diffDays > 0 && diffDays <= 90;
        }).length;
        const eliteCount = loyaltyPrograms.filter(p => {
             const t = (p.tier || '').toLowerCase();
             return t.includes('gold') || t.includes('platinum') || t.includes('diamond') || t.includes('elite') || t.includes('vip') || t.includes('silver');
        }).length;
        
        return { total, expiringSoon, eliteCount };
    }, [loyaltyPrograms]);

    // --- 4. Group Loyalty Programs ---
    const groupedLoyaltyPrograms = useMemo(() => {
        const grouped: Record<string, LoyaltyProgram[]> = {};
        
        loyaltyPrograms.forEach(program => {
            const category = program.category || 'Other';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(program);
        });
        
        // Sort keys alphabetically but keep 'Other' at the end
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        return { grouped, sortedKeys };
    }, [loyaltyPrograms]);


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
    
    const handleOpenLoyaltyModal = (program?: LoyaltyProgram) => {
        setLoyaltyProgramToEdit(program || null);
        setIsLoyaltyModalOpen(true);
    };

    // --- Collapsible Section Component ---
    const LoyaltySection: React.FC<{ title: string; programs: LoyaltyProgram[] }> = ({ title, programs }) => {
        const [isOpen, setIsOpen] = useState(true);
        return (
            <div className="space-y-4">
                <div 
                    className="flex items-center gap-2 cursor-pointer select-none group"
                    onClick={() => setIsOpen(!isOpen)}
                >
                     <div className={`p-1 rounded-md transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                         <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary">expand_more</span>
                     </div>
                    <h3 className="font-bold text-lg text-light-text dark:text-dark-text">{title}</h3>
                    <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">{programs.length}</span>
                    <div className="h-px flex-grow bg-black/5 dark:bg-white/5 ml-2 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors"></div>
                </div>
                
                {isOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        {programs.map(program => (
                            <LoyaltyCard 
                                key={program.id} 
                                program={program} 
                                onClick={() => handleOpenLoyaltyModal(program)} 
                            />
                        ))}
                    </div>
                )}
            </div>
        );
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
            
            {isLoyaltyModalOpen && (
                <LoyaltyProgramModal 
                    onClose={() => setIsLoyaltyModalOpen(false)}
                    onSave={(p) => { saveLoyaltyProgram(p); setIsLoyaltyModalOpen(false); }}
                    onDelete={(id) => { deleteLoyaltyProgram(id); setIsLoyaltyModalOpen(false); }}
                    programToEdit={loyaltyProgramToEdit}
                />
            )}
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                     <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Subscriptions & Loyalty</h1>
                     <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage recurring payments and track rewards programs.</p>
                 </div>
                 
                 <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('recurring')}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'recurring' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}
                    >
                        Recurring Payments
                    </button>
                    <button 
                        onClick={() => setActiveTab('loyalty')}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'loyalty' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}
                    >
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
                                <p className="text-3xl font-extrabold mt-1">{formatCurrency(monthlySpend, 'EUR')}</p>
                                <p className="text-sm opacity-80 mt-2">≈ {formatCurrency(yearlySpend, 'EUR')} / year</p>
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
                                                <p className="text-2xl font-bold text-light-text dark:text-dark-text">{formatCurrency(sub.amount, sub.currency)}</p>
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
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Your Subscriptions</h2>
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
                                                <td className="py-4 font-mono font-medium">{formatCurrency(sub.amount, sub.currency)}</td>
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
                <>
                    {/* Loyalty Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="flex flex-col justify-center p-6 border-l-4 border-l-blue-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Total Programs</p>
                                    <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{loyaltyStats.total}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">wallet</span>
                                </div>
                            </div>
                        </Card>
                        <Card className="flex flex-col justify-center p-6 border-l-4 border-l-purple-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Elite Statuses</p>
                                    <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{loyaltyStats.eliteCount}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">star</span>
                                </div>
                            </div>
                        </Card>
                         <Card className="flex flex-col justify-center p-6 border-l-4 border-l-orange-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Expiring Soon</p>
                                    <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{loyaltyStats.expiringSoon}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">hourglass_bottom</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flex justify-between items-center mt-4 mb-4">
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Your Cards</h2>
                        <button onClick={() => handleOpenLoyaltyModal()} className={BTN_PRIMARY_STYLE}>
                            <span className="material-symbols-outlined text-lg mr-2">add</span> Add Program
                        </button>
                    </div>
                    
                    {loyaltyPrograms.length > 0 ? (
                        <div className="space-y-8">
                            {groupedLoyaltyPrograms.sortedKeys.map(category => (
                                <LoyaltySection 
                                    key={category} 
                                    title={category} 
                                    programs={groupedLoyaltyPrograms.grouped[category]} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-light-card dark:bg-dark-card rounded-xl border border-dashed border-black/10 dark:border-white/10">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                                <span className="material-symbols-outlined text-3xl">card_membership</span>
                            </div>
                            <h3 className="font-bold text-light-text dark:text-dark-text mb-1">No loyalty programs yet</h3>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">Add your frequent flyer miles, supermarket points, and gym memberships here.</p>
                            <button onClick={() => handleOpenLoyaltyModal()} className={BTN_SECONDARY_STYLE}>Add First Program</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Subscriptions;
