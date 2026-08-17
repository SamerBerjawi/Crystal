import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Category, MerchantRule, MerchantLocation, Transaction } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency, parseLocalDate } from '../utils';
import { BarChart, Bar, Grid, BarXAxis, YAxis, ChartTooltip } from '@/src/components/charts';
import { getMerchantLogoUrl, isBrandfetchLogoRefreshable } from '../utils/brandfetch';
import { toast } from 'sonner';
import Icon from './ui/Icon';
import AddressAutocomplete from './AddressAutocomplete';
import { AddressData } from '../hooks/useAddressSearch';

interface MerchantDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    merchantName: string;
    logoKey: string;
    initialRule?: MerchantRule;
    onSave: (key: string, rule: MerchantRule) => void;
    incomeCategories: Category[];
    expenseCategories: Category[];
    transactions: Transaction[];
    brandfetchClientId?: string;
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
    <>
        <option value="">No Default Category</option>
        {categories.map(parentCat => (
            <optgroup key={parentCat.id} label={parentCat.name}>
                <option value={parentCat.name}>{parentCat.name}</option>
                {parentCat.subCategories.map(subCat => (
                    <option key={subCat.id} value={subCat.name}>
                        &nbsp;&nbsp;{subCat.name}
                    </option>
                ))}
            </optgroup>
        ))}
    </>
);

type ActiveTabType = 'rules' | 'locations' | 'branding' | 'telemetry';

const MerchantDetailModal: React.FC<MerchantDetailModalProps> = ({
    isOpen,
    onClose,
    merchantName,
    logoKey,
    initialRule,
    onSave,
    incomeCategories,
    expenseCategories,
    transactions,
    brandfetchClientId
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTabType>('rules');

    // Rule Configuration State
    const [category, setCategory] = useState(initialRule?.category || '');
    const [website, setWebsite] = useState(initialRule?.website || '');
    const [logo, setLogo] = useState(initialRule?.logo || '');
    const [isHidden, setIsHidden] = useState(initialRule?.isHidden || false);
    const [defaultDescription, setDefaultDescription] = useState(initialRule?.defaultDescription || '');
    const [notes, setNotes] = useState(initialRule?.notes || '');
    const [isOnline, setIsOnline] = useState(initialRule?.isOnline || false);
    const [refreshTimestamp, setRefreshTimestamp] = useState<number | undefined>(undefined);

    // Multi-Address & Branches State
    const [locations, setLocations] = useState<MerchantLocation[]>(() => {
        if (initialRule?.locations && initialRule.locations.length > 0) {
            return initialRule.locations;
        }
        if (initialRule?.address) {
            return [{
                id: `loc-default-${Date.now()}`,
                label: initialRule.placeName || 'Main Branch',
                address: initialRule.address,
                placeName: initialRule.placeName,
                street: initialRule.street,
                city: initialRule.city || '',
                postalCode: initialRule.postalCode,
                state: initialRule.state,
                country: initialRule.country || '',
                latitude: initialRule.latitude,
                longitude: initialRule.longitude,
                isPrimary: true
            }];
        }
        return [];
    });

    // Form state for adding a new branch
    const [isAddingBranch, setIsAddingBranch] = useState(false);
    const [newBranchLabel, setNewBranchLabel] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [newBranchData, setNewBranchData] = useState<AddressData | null>(null);

    // ID of the location currently being edited / fine-tuned
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Drawer entrance animation & Escape listener
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Slight tick to trigger entrance animation
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCloseDrawer();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleCloseDrawer = () => {
        setIsVisible(false);
        setTimeout(onClose, 280);
    };

    const isCustomUpload = logo.startsWith('data:image/') || logo.startsWith('http://') || logo.startsWith('https://');
    const canRefreshFromBrandfetch = isBrandfetchLogoRefreshable(merchantName, logo);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (PNG, JPG, SVG, WEBP, etc.)');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setLogo(reader.result);
                toast.success('Custom logo loaded successfully!');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    // Location Management Handlers
    const handleNewAddressSelect = (newVal: string, addressData?: AddressData) => {
        setNewBranchAddress(newVal);
        if (addressData) {
            setNewBranchData(addressData);
            if (!newBranchLabel.trim()) {
                setNewBranchLabel(addressData.placeName || addressData.city || `Branch ${locations.length + 1}`);
            }
        } else if (!newVal) {
            setNewBranchData(null);
        }
    };

    const handleAddBranch = () => {
        if (!newBranchAddress.trim()) {
            toast.error('Please enter or select an address for this branch.');
            return;
        }

        const newLoc: MerchantLocation = {
            id: `loc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            label: newBranchLabel.trim() || newBranchData?.placeName || newBranchData?.city || `Branch ${locations.length + 1}`,
            address: newBranchAddress.trim(),
            placeName: newBranchData?.placeName || undefined,
            street: newBranchData?.street || undefined,
            city: newBranchData?.city || '',
            postalCode: newBranchData?.postalCode || undefined,
            state: newBranchData?.state || undefined,
            country: newBranchData?.country || '',
            latitude: newBranchData?.lat,
            longitude: newBranchData?.lon,
            isPrimary: locations.length === 0
        };

        setLocations(prev => [...prev, newLoc]);
        setNewBranchLabel('');
        setNewBranchAddress('');
        setNewBranchData(null);
        setIsAddingBranch(false);
        toast.success(`Branch "${newLoc.label}" added!`);
    };

    const handleRemoveBranch = (id: string) => {
        setLocations(prev => {
            const next = prev.filter(l => l.id !== id);
            if (next.length > 0 && !next.some(l => l.isPrimary)) {
                next[0].isPrimary = true;
            }
            return next;
        });
        toast.success('Branch removed.');
    };

    const handleSetPrimaryBranch = (id: string) => {
        setLocations(prev => prev.map(l => ({
            ...l,
            isPrimary: l.id === id
        })));
        toast.success('Primary branch updated.');
    };

    const handleUpdateBranchField = (id: string, field: keyof MerchantLocation, value: any) => {
        setLocations(prev => prev.map(l => {
            if (l.id !== id) return l;
            return {
                ...l,
                [field]: value
            };
        }));
    };

    // Initialize with smart guesses if rule doesn't exist
    useEffect(() => {
        if (!initialRule) {
            if (logoKey.includes('.')) {
                setWebsite(`https://${logoKey}`);
            }
        }
    }, [initialRule, logoKey]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const primaryLoc = locations.find(l => l.isPrimary) || locations[0];

        onSave(logoKey, {
            category: category || undefined,
            website: website || undefined,
            logo: logo || undefined,
            isHidden,
            isOnline,
            defaultDescription: defaultDescription || undefined,
            notes: notes || undefined,
            locations: locations.length > 0 ? locations : undefined,
            // Sync primary location to top-level fields for backwards compatibility:
            address: primaryLoc?.address || undefined,
            placeName: primaryLoc?.placeName || undefined,
            street: primaryLoc?.street || undefined,
            city: primaryLoc?.city || undefined,
            postalCode: primaryLoc?.postalCode || undefined,
            state: primaryLoc?.state || undefined,
            country: primaryLoc?.country || undefined,
            latitude: primaryLoc?.latitude,
            longitude: primaryLoc?.longitude,
        });
        toast.success(`Saved protocol for "${merchantName}"`);
        handleCloseDrawer();
    };

    // Calculate basic stats and recent transactions for the merchant
    const { totalCount, totalAmount, averageAmount, chartData, recentMerchantTxs } = useMemo(() => {
        const merchantTxs = (transactions || []).filter(t => t.merchant === merchantName);
        const count = merchantTxs.length;
        const total = merchantTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const avg = count > 0 ? total / count : 0;

        // Monthly trend (last 6 months)
        const today = new Date();
        const trendData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = d.toLocaleString('default', { month: 'short' });
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            const monthTotal = merchantTxs
                .filter(t => {
                    const td = parseLocalDate(t.date);
                    return td >= start && td <= end;
                })
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);

            trendData.push({ name: monthKey, value: monthTotal });
        }

        // Sorted recent transactions
        const sortedTxs = [...merchantTxs]
            .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
            .slice(0, 10);

        return {
            totalCount: count,
            totalAmount: total,
            averageAmount: avg,
            chartData: trendData,
            recentMerchantTxs: sortedTxs
        };
    }, [transactions, merchantName]);

    const allCategories = [...expenseCategories, ...incomeCategories];
    const previewLogoUrl = getMerchantLogoUrl(
        merchantName, 
        brandfetchClientId, 
        { [logoKey]: logo || logoKey }, 
        { fallback: 'lettermark', type: 'icon', width: 120, height: 120, refreshTimestamp }
    );

    const handleRefreshBrandfetchLogo = () => {
        if (!canRefreshFromBrandfetch) return;
        setRefreshTimestamp(Date.now());
        toast.success(`Fetched latest logo from Brandfetch for "${merchantName}"!`);
    };

    const labelStyle = "block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5";

    if (!isOpen && !isVisible) return null;

    const drawerContent = (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* Backdrop Blur Overlay */}
            <div 
                className={`fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity duration-300 ${
                    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={handleCloseDrawer}
            />

            {/* Right-Side Full Height Slide-out Drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div 
                    className={`w-screen max-w-xl md:max-w-2xl h-screen bg-white dark:bg-[#12141a] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col justify-between transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 1. Header Section */}
                    <div className="shrink-0 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                        {/* Top Action Ribbon */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-full border border-primary-500/20">
                                    <Icon name="Building02" className="text-xs" />
                                    Entity Protocol
                                </span>
                                {isHidden && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                        <Icon name="eye_off" className="text-xs" />
                                        Hidden
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {canRefreshFromBrandfetch && (
                                    <button
                                        type="button"
                                        onClick={handleRefreshBrandfetchLogo}
                                        className="p-2 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                        title="Fetch latest branding from Brandfetch"
                                    >
                                        <Icon name="magic_wand" className="text-base" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleCloseDrawer}
                                    className="p-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-xs font-bold"
                                    title="Close panel (Esc)"
                                >
                                    <Icon name="close" className="text-lg" />
                                    <span className="hidden sm:inline text-xs font-medium text-gray-400 font-mono">ESC</span>
                                </button>
                            </div>
                        </div>

                        {/* Merchant Identity & Metrics Hero */}
                        <div className="px-6 pb-5 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative group w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 shadow-sm flex items-center justify-center">
                                    {previewLogoUrl ? (
                                        <img src={previewLogoUrl} alt={merchantName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl font-black text-primary-500">{merchantName.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-xl sm:text-2xl font-black text-light-text dark:text-dark-text tracking-tight truncate leading-tight">
                                            {merchantName}
                                        </h2>
                                        {isOnline && (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                                🌐 Online Business
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                                        {website ? (
                                            <a 
                                                href={website} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-xs font-bold text-primary-500 hover:underline flex items-center gap-1"
                                            >
                                                <span>{website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                                <Icon name="open_in_new" className="text-xs" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                                No website linked
                                            </span>
                                        )}
                                        {category && (
                                            <span className="inline-flex items-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5">
                                                {category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stat Highlights Cards */}
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-0.5">
                                        Volume
                                    </p>
                                    <p className="font-mono font-black text-sm text-light-text dark:text-dark-text truncate">
                                        {formatCurrency(totalAmount, 'EUR')}
                                    </p>
                                </div>
                                <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-0.5">
                                        Avg Ticket
                                    </p>
                                    <p className="font-mono font-black text-sm text-light-text dark:text-dark-text truncate">
                                        {formatCurrency(averageAmount, 'EUR')}
                                    </p>
                                </div>
                                <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-2xs">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 mb-0.5">
                                        Activity
                                    </p>
                                    <p className="font-mono font-black text-sm text-light-text dark:text-dark-text truncate">
                                        {totalCount} Events
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Segmented Navigation Tabs */}
                        <div className="px-6 flex gap-1 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setActiveTab('rules')}
                                className={`py-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    activeTab === 'rules'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                                        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                <Icon name="code" className="text-sm" />
                                <span>Rules & Routing</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('locations')}
                                className={`py-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    activeTab === 'locations'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                                        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                <Icon name="marker_pin" className="text-sm" />
                                <span>Locations</span>
                                {isOnline ? (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        🌐 Online
                                    </span>
                                ) : locations.length > 0 && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500">
                                        {locations.length}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('branding')}
                                className={`py-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    activeTab === 'branding'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                                        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                <Icon name="magic_wand" className="text-sm" />
                                <span>Branding & Logo</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('telemetry')}
                                className={`py-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    activeTab === 'telemetry'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/5'
                                        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                <Icon name="coins_stacked" className="text-sm" />
                                <span>Insights</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. Scrollable Body Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <form id="merchant-protocol-form" onSubmit={handleSubmit} className="space-y-6">
                            {/* TAB 1: RULES & ROUTING */}
                            {activeTab === 'rules' && (
                                <div className="space-y-5 animate-fade-in">
                                    {/* Default Classification Category */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className={labelStyle}>Default Category Classification</label>
                                            <span className="text-xs text-primary-500 font-semibold uppercase tracking-wider">Auto-Classification</span>
                                        </div>
                                        <div className={SELECT_WRAPPER_STYLE}>
                                            <select
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                                className={SELECT_STYLE}
                                            >
                                                <CategoryOptions categories={allCategories} />
                                            </select>
                                            <div className={SELECT_ARROW_STYLE}><Icon name="expand_more" /></div>
                                        </div>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                            Telemetry ingestion will automatically route new transactions from this merchant to this category.
                                        </p>
                                    </div>

                                    {/* Default Description */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <label className={labelStyle}>Default Transaction Description</label>
                                        <input
                                            type="text"
                                            value={defaultDescription}
                                            onChange={e => setDefaultDescription(e.target.value)}
                                            className={INPUT_BASE_STYLE}
                                            placeholder="e.g. Monthly Software License"
                                        />
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                            Prefills the description field whenever this merchant is selected during manual transaction logging.
                                        </p>
                                    </div>

                                    {/* Internal Notes */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <label className={labelStyle}>Operational Notes & Reference</label>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className={`${INPUT_BASE_STYLE} min-h-[85px] resize-none`}
                                            placeholder="Contract IDs, customer service contacts, account references, cancellation terms..."
                                        />
                                    </div>

                                    {/* Visibility Toggle */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Icon name={isHidden ? "eye_off" : "eye"} className="text-base text-primary-500" />
                                                    <span className="text-xs font-bold text-light-text dark:text-dark-text">
                                                        Hide from Merchant Pickers
                                                    </span>
                                                </div>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                                    Hides this merchant from quick autocomplete pickers without affecting historical transaction data.
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isHidden}
                                                onChange={e => setIsHidden(e.target.checked)}
                                                className={CHECKBOX_STYLE}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: LOCATIONS & BRANCHES */}
                            {activeTab === 'locations' && (
                                <div className="space-y-5 animate-fade-in">
                                    {/* Online Business Mode Toggle Card */}
                                    <div className={`p-4.5 rounded-3xl border transition-all ${
                                        isOnline 
                                            ? 'bg-blue-500/[0.06] dark:bg-blue-500/[0.08] border-blue-500/30 dark:border-blue-500/20' 
                                            : 'bg-gray-50/70 dark:bg-white/[0.02] border-black/5 dark:border-white/5'
                                    }`}>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="space-y-0.5 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">🌐</span>
                                                    <span className="text-xs font-bold text-light-text dark:text-dark-text">
                                                        Online / Digital Business
                                                    </span>
                                                    {isOnline && (
                                                        <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                                    Toggle on for web stores, SaaS platforms, streaming subscriptions, and cloud services (e.g. Amazon, Netflix, Spotify, Steam) with no physical storefront.
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isOnline}
                                                onChange={e => setIsOnline(e.target.checked)}
                                                className={CHECKBOX_STYLE}
                                            />
                                        </label>
                                    </div>

                                    {/* Info banner when Online Business is enabled */}
                                    {isOnline && (
                                        <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 animate-fade-in-up">
                                            <Icon name="info" className="text-blue-500 text-base shrink-0 mt-0.5" />
                                            <div className="text-xs space-y-1 text-light-text dark:text-dark-text">
                                                <p className="font-bold">Digital / Web Service Protocol Enabled</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                                    Transactions for {merchantName} are classified as online digital orders and won't require physical map coordinates. You can still optionally add local pickup lockers or regional headquarters below if desired.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-1">
                                        <div>
                                            <h4 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text flex items-center gap-1.5">
                                                <Icon name="marker_pin" className="text-sm text-primary-500" />
                                                <span>{isOnline ? 'Optional Fulfillment Centers & Pickups' : 'Configured Branches & Locations'}</span>
                                            </h4>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                {isOnline ? 'Add optional physical pickup lockers, hub locations, or regional offices.' : 'Map multiple physical stores, warehouses, or office locations.'}
                                            </p>
                                        </div>
                                        {!isAddingBranch && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingBranch(true)}
                                                className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/15 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                                            >
                                                <Icon name="add" className="text-sm" />
                                                <span>Add Branch</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* List of Configured Branches */}
                                    {locations.length > 0 ? (
                                        <div className="space-y-3">
                                            {locations.map((loc, idx) => {
                                                const isEditingThis = editingLocationId === loc.id;
                                                return (
                                                    <div 
                                                        key={loc.id} 
                                                        className={`p-4 rounded-3xl border transition-all ${
                                                            loc.isPrimary 
                                                                ? 'bg-primary-500/[0.04] dark:bg-primary-500/[0.06] border-primary-500/30 dark:border-primary-500/20' 
                                                                : 'bg-gray-50/70 dark:bg-white/[0.02] border-black/5 dark:border-white/10'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                                    loc.isPrimary ? 'bg-primary-500 text-white shadow-sm' : 'bg-black/5 dark:bg-white/10 text-primary-500'
                                                                }`}>
                                                                    <Icon name="marker_pin" className="text-base" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="text-xs font-bold text-light-text dark:text-dark-text leading-snug">
                                                                            {loc.label || `Branch #${idx + 1}`}
                                                                        </p>
                                                                        {loc.isPrimary ? (
                                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                                ★ Primary Branch
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSetPrimaryBranch(loc.id)}
                                                                                className="text-xs font-medium text-gray-400 hover:text-primary-500 hover:underline transition-colors"
                                                                            >
                                                                                Set as Primary
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-normal">
                                                                        {loc.address}
                                                                    </p>
                                                                    {(loc.latitude !== undefined && loc.longitude !== undefined) && (
                                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                            <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md text-primary-600 dark:text-primary-400">
                                                                                📍 {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                                                                            </span>
                                                                            {loc.country && (
                                                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                                                                    {loc.country}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Branch Quick Actions */}
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {loc.latitude !== undefined && loc.longitude !== undefined && (
                                                                    <a
                                                                        href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="p-2 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                                                        title="Open in Google Maps"
                                                                    >
                                                                        <Icon name="open_in_new" className="text-xs" />
                                                                    </a>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingLocationId(isEditingThis ? null : loc.id)}
                                                                    className={`p-2 rounded-xl transition-colors ${
                                                                        isEditingThis 
                                                                            ? 'bg-primary-500/10 text-primary-500' 
                                                                            : 'text-gray-400 hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/10'
                                                                    }`}
                                                                    title="Fine-tune details & coordinates"
                                                                >
                                                                    <Icon name="tune" className="text-xs" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveBranch(loc.id)}
                                                                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                                    title="Remove Branch"
                                                                >
                                                                    <Icon name="delete" className="text-xs" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Inline Fine-tuning Drawer */}
                                                        {isEditingThis && (
                                                            <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3 animate-fade-in-up">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">Branch Name / Label</label>
                                                                        <input
                                                                            type="text"
                                                                            value={loc.label || ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'label', e.target.value)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs`}
                                                                            placeholder="e.g. Zaventem Branch"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">City / Municipality</label>
                                                                        <input
                                                                            type="text"
                                                                            value={loc.city || ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'city', e.target.value)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs`}
                                                                            placeholder="e.g. Zaventem"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">Country</label>
                                                                        <input
                                                                            type="text"
                                                                            value={loc.country || ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'country', e.target.value)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs`}
                                                                            placeholder="e.g. Belgium"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">Postal Code</label>
                                                                        <input
                                                                            type="text"
                                                                            value={loc.postalCode || ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'postalCode', e.target.value)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs`}
                                                                            placeholder="e.g. 1930"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">Latitude</label>
                                                                        <input
                                                                            type="number"
                                                                            step="any"
                                                                            value={loc.latitude ?? ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs font-mono`}
                                                                            placeholder="50.8717"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-light-text-secondary mb-1">Longitude</label>
                                                                        <input
                                                                            type="number"
                                                                            step="any"
                                                                            value={loc.longitude ?? ''}
                                                                            onChange={e => handleUpdateBranchField(loc.id, 'longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                            className={`${INPUT_BASE_STYLE} !py-1.5 !text-xs font-mono`}
                                                                            placeholder="4.4919"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingLocationId(null)}
                                                                        className="text-xs font-bold text-primary-500 hover:underline"
                                                                    >
                                                                        Done Editing
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 text-center space-y-2">
                                            <Icon name="marker_pin" className="text-3xl text-gray-400 mx-auto" />
                                            <p className="text-xs font-bold text-light-text dark:text-dark-text">No Physical Locations Added</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto">
                                                Add addresses or store branches to enable exact coordinate geolocation on your transaction maps.
                                            </p>
                                        </div>
                                    )}

                                    {/* Add Branch Form */}
                                    {(isAddingBranch || locations.length === 0) && (
                                        <div className="p-5 rounded-3xl bg-primary-500/[0.03] dark:bg-primary-500/[0.05] border border-dashed border-primary-500/30 space-y-3.5 animate-fade-in-up">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text flex items-center gap-1.5">
                                                    <Icon name="add" className="text-xs text-primary-500" />
                                                    <span>{locations.length === 0 ? 'Add Primary Branch' : 'Add New Branch'}</span>
                                                </h5>
                                                {locations.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsAddingBranch(false);
                                                            setNewBranchLabel('');
                                                            setNewBranchAddress('');
                                                            setNewBranchData(null);
                                                        }}
                                                        className="text-xs font-medium text-light-text-secondary hover:text-light-text"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-light-text-secondary mb-1">
                                                    Branch Label / Nickname (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newBranchLabel}
                                                    onChange={e => setNewBranchLabel(e.target.value)}
                                                    className={`${INPUT_BASE_STYLE} !py-2 !text-xs`}
                                                    placeholder="e.g. Zaventem Flagship, Downtown Branch..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-light-text-secondary mb-1">
                                                    Address / Public Map Search
                                                </label>
                                                <AddressAutocomplete
                                                    value={newBranchAddress}
                                                    onChange={handleNewAddressSelect}
                                                    placeholder="Search address, store, or city..."
                                                />
                                            </div>

                                            {newBranchData && (
                                                <div className="p-3 bg-white dark:bg-dark-card rounded-2xl border border-primary-500/20 text-xs flex items-center justify-between shadow-2xs">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-light-text dark:text-dark-text truncate">{newBranchData.title}</p>
                                                        <p className="text-xs text-light-text-secondary truncate">{newBranchData.formattedAddress}</p>
                                                    </div>
                                                    <span className="text-xs font-mono text-primary-500 ml-2 shrink-0">
                                                        📍 {newBranchData.lat.toFixed(4)}°, {newBranchData.lon.toFixed(4)}°
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 pt-1">
                                                {locations.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsAddingBranch(false);
                                                            setNewBranchLabel('');
                                                            setNewBranchAddress('');
                                                            setNewBranchData(null);
                                                        }}
                                                        className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3.5 !text-xs`}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleAddBranch}
                                                    className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-5 !text-xs`}
                                                >
                                                    Save Branch
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: BRANDING & ASSETS */}
                            {activeTab === 'branding' && (
                                <div className="space-y-5 animate-fade-in">
                                    {/* Active Logo Asset Status */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                                        <label className={labelStyle}>Active Branding Asset</label>
                                        <div className="flex items-center justify-between p-3.5 bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0">
                                                    {previewLogoUrl ? (
                                                        <img src={previewLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="font-bold text-lg text-gray-400">{merchantName.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-light-text dark:text-dark-text">
                                                        {isCustomUpload ? 'Manual Image Upload' : (logo ? `Domain: ${logo}` : 'Automatic Telemetry Lookup')}
                                                    </p>
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                        {isCustomUpload ? 'Overrides Brandfetch lookups globally' : 'Cached via Brandfetch CDN endpoint'}
                                                    </p>
                                                </div>
                                            </div>

                                            {isCustomUpload && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLogo('')}
                                                    className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Brandfetch Domain Input */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <label className={labelStyle}>Brand Domain Override</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={logo}
                                                onChange={e => setLogo(e.target.value)}
                                                className={INPUT_BASE_STYLE}
                                                placeholder="e.g. apple.com, netflix.com, ikea.com"
                                            />
                                            {canRefreshFromBrandfetch && (
                                                <button
                                                    type="button"
                                                    onClick={handleRefreshBrandfetchLogo}
                                                    className={`${BTN_SECONDARY_STYLE} shrink-0 !py-2 !px-3 text-xs flex items-center gap-1`}
                                                >
                                                    <Icon name="refresh" className="text-xs" />
                                                    <span>Fetch</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                                            Enter the official brand domain to automatically pull matching high-resolution logos and icons from Brandfetch.
                                        </p>
                                    </div>

                                    {/* Custom Logo Upload Dropzone */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <label className={labelStyle}>Upload Custom Vector / Image</label>
                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                                isDragging 
                                                    ? 'border-primary-500 bg-primary-500/5' 
                                                    : 'border-black/10 dark:border-white/10 hover:border-primary-500/40 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]'
                                            }`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <Icon name="upload_file" className="text-2xl text-light-text-secondary dark:text-dark-text-secondary mb-1" />
                                            <p className="text-xs font-bold text-light-text dark:text-dark-text">Click or drag image here</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Supports PNG, SVG, JPG, WEBP</p>
                                        </div>
                                    </div>

                                    {/* Website URL */}
                                    <div className="p-4.5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                        <label className={labelStyle}>Official Website URL</label>
                                        <input
                                            type="text"
                                            value={website}
                                            onChange={e => setWebsite(e.target.value)}
                                            className={INPUT_BASE_STYLE}
                                            placeholder="https://www.example.com"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: TELEMETRY & INSIGHTS */}
                            {activeTab === 'telemetry' && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* 6-Month Spending Trend using bklit/bar-chart */}
                                    <div className="p-5 rounded-3xl bg-gray-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text flex items-center gap-1.5">
                                                    <Icon name="coins_stacked" className="text-sm text-primary-500" />
                                                    <span>6-Month Spending Trajectory</span>
                                                </h4>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                                    Historical monthly outflow aggregates for {merchantName}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                    Period Volume: <span className="text-light-text dark:text-dark-text font-mono font-bold">{formatCurrency(totalAmount, 'EUR')}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {chartData.some(d => d.value > 0) ? (
                                            <div className="h-48 w-full pt-2">
                                                <BarChart
                                                    data={chartData}
                                                    xDataKey="name"
                                                    aspectRatio="auto"
                                                    margin={{ top: 12, right: 16, left: 48, bottom: 24 }}
                                                    className="w-full h-full"
                                                    animationDuration={900}
                                                >
                                                    <Grid horizontal vertical={false} strokeOpacity={0.06} />
                                                    <Bar 
                                                        dataKey="value" 
                                                        fill="#3B82F6" 
                                                        lineCap="round" 
                                                    />
                                                    <BarXAxis showAllLabels maxLabels={6} />
                                                    <YAxis 
                                                        numTicks={4} 
                                                        formatValue={(v: number) => formatCurrency(v, 'EUR', { compact: true })} 
                                                    />
                                                    <ChartTooltip
                                                        valueFormatter={(val: number) => formatCurrency(val, 'EUR')}
                                                    />
                                                </BarChart>
                                            </div>
                                        ) : (
                                            <div className="h-40 w-full flex flex-col items-center justify-center p-6 text-center space-y-1.5 border border-dashed border-black/5 dark:border-white/5 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01]">
                                                <Icon name="calendar" className="text-2xl text-gray-400" />
                                                <p className="text-xs font-bold text-light-text dark:text-dark-text">No Recent Spending in Last 6 Months</p>
                                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    Transactions logged for this merchant will appear in this monthly spending trajectory.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent Observed Transactions */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold tracking-tight text-light-text dark:text-dark-text">
                                                Recent Observed Transactions ({recentMerchantTxs.length})
                                            </h4>
                                            <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                Latest History
                                            </span>
                                        </div>

                                        {recentMerchantTxs.length > 0 ? (
                                            <div className="space-y-2">
                                                {recentMerchantTxs.map(tx => (
                                                    <div 
                                                        key={tx.id} 
                                                        className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between gap-3 shadow-2xs"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">
                                                                    {tx.description}
                                                                </p>
                                                                {tx.category && (
                                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary">
                                                                        {tx.category}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-60 mt-0.5">
                                                                {parseLocalDate(tx.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                {tx.address && ` • 📍 ${tx.address}`}
                                                            </p>
                                                        </div>

                                                        <p className={`font-mono font-bold text-xs tracking-tight ${
                                                            tx.type === 'income' ? 'text-green-500' : 'text-light-text dark:text-dark-text'
                                                        }`}>
                                                            {formatCurrency(tx.amount, tx.currency)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] border border-dashed border-black/5 dark:border-white/5 text-center text-xs text-light-text-secondary">
                                                No transactions logged for this merchant yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* 3. Sticky Drawer Footer */}
                    <div className="shrink-0 p-5 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12141a]/95 backdrop-blur-md flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setCategory('');
                                setDefaultDescription('');
                                setNotes('');
                                setWebsite('');
                                setLogo('');
                                setIsHidden(false);
                                setLocations([]);
                                toast.info('Reset unsaved fields');
                            }}
                            className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors"
                        >
                            Reset Fields
                        </button>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleCloseDrawer}
                                className={`${BTN_SECONDARY_STYLE} !py-2 !px-4 !text-xs`}
                            >
                                Dismiss
                            </button>

                            <button
                                type="submit"
                                form="merchant-protocol-form"
                                className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 !text-xs flex items-center gap-1.5 shadow-md shadow-primary-500/20`}
                            >
                                <Icon name="check" className="text-xs" />
                                <span>Save Protocol</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
};

export default MerchantDetailModal;
