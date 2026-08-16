
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Category, MerchantRule, MerchantLocation } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency, parseLocalDate } from '../utils';
import { BarChart, Bar, Grid, BarXAxis, BarYAxis, ChartTooltip } from '@/src/components/charts';
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
    transactions: any[]; // Passed to show simple stats
    brandfetchClientId?: string;
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
    <>
        <option value="">No Default</option>
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
    const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
    const [category, setCategory] = useState(initialRule?.category || '');
    const [website, setWebsite] = useState(initialRule?.website || '');
    const [logo, setLogo] = useState(initialRule?.logo || '');
    const [isHidden, setIsHidden] = useState(initialRule?.isHidden || false);
    const [defaultDescription, setDefaultDescription] = useState(initialRule?.defaultDescription || '');
    const [notes, setNotes] = useState(initialRule?.notes || '');
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
            // If the deleted branch was primary and other branches exist, set the first one as primary
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
            // If no website set, try to guess from logo key if it looks like a domain
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
        onClose();
    };

    // Calculate basic stats for the merchant
    const stats = useMemo(() => {
        const merchantTxs = transactions.filter(t => t.merchant === merchantName);
        const totalCount = merchantTxs.length;
        const totalAmount = merchantTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

        // Monthly trend (last 6 months)
        const today = new Date();
        const chartData = [];
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

            chartData.push({ name: monthKey, value: monthTotal });
        }

        return { totalCount, totalAmount, averageAmount, chartData };
    }, [transactions, merchantName]);

    const allCategories = [...expenseCategories, ...incomeCategories];
    const previewLogoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, { [logoKey]: logo || logoKey }, { fallback: 'lettermark', type: 'icon', width: 80, height: 80, refreshTimestamp });

    const handleRefreshBrandfetchLogo = () => {
        if (!canRefreshFromBrandfetch) return;
        setRefreshTimestamp(Date.now());
        toast.success(`Fetched latest logo from Brandfetch for "${merchantName}"!`);
    };

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title="Merchant Details">
            <div className="flex flex-col gap-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-white/10">
                        {previewLogoUrl ? (
                            <img src={previewLogoUrl} alt={merchantName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-bold text-gray-400">{merchantName.charAt(0)}</span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-light-text dark:text-dark-text">{merchantName}</h2>
                            {canRefreshFromBrandfetch && (
                                <button
                                    type="button"
                                    onClick={handleRefreshBrandfetchLogo}
                                    className="p-1 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    title="Fetch latest logo from Brandfetch"
                                >
                                    <Icon name="refresh" className="text-sm" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {website && (
                                <a href={website} target="_blank" rel="noreferrer" className="text-xs text-primary-500 hover:underline flex items-center gap-1">
                                    {website.replace(/^https?:\/\//, '')} <Icon name="open_in_new" className="text-[10px]" />
                                </a>
                            )}
                            {isHidden && <span className="text-[10px] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-gray-500 font-bold  tracking-wide">Hidden</span>}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Settings
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'stats' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        History & Stats
                    </button>
                </div>

                {activeTab === 'settings' ? (
                    <form id="merchant-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={labelStyle}>Default Category</label>
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
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                Automatically apply this category to future transactions from this merchant.
                            </p>
                        </div>

                        <div>
                            <label className={labelStyle}>Default Description</label>
                            <input
                                type="text"
                                value={defaultDescription}
                                onChange={e => setDefaultDescription(e.target.value)}
                                className={INPUT_BASE_STYLE}
                                placeholder="e.g. Monthly Subscription"
                            />
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                Prefills the description field when creating a new transaction for this merchant.
                            </p>
                        </div>

                        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold tracking-tight text-light-text-secondary dark:text-dark-text-secondary">Brand Identity</h4>
                                {canRefreshFromBrandfetch && (
                                    <button
                                        type="button"
                                        onClick={handleRefreshBrandfetchLogo}
                                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 bg-primary-500/10 px-2.5 py-1 rounded-lg transition-colors"
                                        title="Fetch latest logo from Brandfetch"
                                    >
                                        <Icon name="refresh" className="text-xs" />
                                        <span>Refresh from Brandfetch</span>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {isCustomUpload ? (
                                    <div className="flex flex-col justify-between p-4 bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl h-[100px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white flex items-center justify-center p-1 shrink-0">
                                                <img src={logo} className="max-w-full max-h-full object-contain" alt="Custom logo" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">Custom Logo Loaded</p>
                                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate">Using manual image asset</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLogo('')}
                                            className="text-[10px] font-black  tracking-widest text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 self-start transition-colors"
                                        >
                                            Remove Custom Logo
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <label className={labelStyle}>Brand Domain</label>
                                        <input
                                            type="text"
                                            value={logo}
                                            onChange={e => setLogo(e.target.value)}
                                            className={INPUT_BASE_STYLE}
                                            placeholder="e.g. netflix.com"
                                        />
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                            Auto-fetches matching telemetry from Brandfetch.
                                        </p>
                                    </div>
                                )}

                                {isCustomUpload ? (
                                    <div className="flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest">Logo Precedence</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                                            This custom logo overrides Brandfetch lookups and is synchronized globally across all of your telemetry reports.
                                        </p>
                                    </div>
                                ) : (
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[100px] ${isDragging ? 'border-primary-500 bg-primary-500/5' : 'border-black/10 dark:border-white/10 hover:border-primary-500/40 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]'}`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <Icon name="upload_file" className="text-xl text-light-text-secondary dark:text-dark-text-secondary mb-0.5" />
                                        <p className="text-[10px] font-black  tracking-widest text-light-text dark:text-dark-text">Upload Custom Logo</p>
                                        <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Drag-and-drop or click here</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={labelStyle}>Website URL</label>
                                <input
                                    type="text"
                                    value={website}
                                    onChange={e => setWebsite(e.target.value)}
                                    className={INPUT_BASE_STYLE}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Multiple Physical Addresses & Branches */}
                        <div className="space-y-3.5 pt-2 border-t border-black/5 dark:border-white/5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold tracking-tight text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
                                            <Icon name="marker_pin" className="text-xs text-primary-500" />
                                            <span>Addresses & Branches</span>
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold">
                                            {locations.length} {locations.length === 1 ? 'Branch' : 'Branches'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                        Add multiple store locations or branch addresses for map telemetry.
                                    </p>
                                </div>
                                {!isAddingBranch && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingBranch(true)}
                                        className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 bg-primary-500/10 hover:bg-primary-500/15 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Icon name="add" className="text-xs" />
                                        <span>Add Branch</span>
                                    </button>
                                )}
                            </div>

                            {/* List of Configured Branches */}
                            {locations.length > 0 && (
                                <div className="space-y-2.5">
                                    {locations.map((loc, idx) => {
                                        const isEditingThis = editingLocationId === loc.id;
                                        return (
                                            <div 
                                                key={loc.id} 
                                                className={`p-3.5 rounded-2xl border transition-all ${
                                                    loc.isPrimary 
                                                        ? 'bg-primary-500/[0.03] dark:bg-primary-500/[0.05] border-primary-500/30 dark:border-primary-500/20' 
                                                        : 'bg-gray-50 dark:bg-white/[0.02] border-black/5 dark:border-white/10'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                            loc.isPrimary ? 'bg-primary-500 text-white shadow-xs' : 'bg-black/5 dark:bg-white/10 text-primary-500'
                                                        }`}>
                                                            <Icon name="marker_pin" className="text-base" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-xs font-bold text-light-text dark:text-dark-text leading-snug">
                                                                    {loc.label || `Branch #${idx + 1}`}
                                                                </p>
                                                                {loc.isPrimary ? (
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                        ★ Primary Branch
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetPrimaryBranch(loc.id)}
                                                                        className="text-[9px] font-bold text-gray-400 hover:text-primary-500 hover:underline transition-colors"
                                                                    >
                                                                        Set as Primary
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-normal">
                                                                {loc.address}
                                                            </p>
                                                            {(loc.latitude !== undefined && loc.longitude !== undefined) && (
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-primary-600 dark:text-primary-400">
                                                                        📍 {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                                                                    </span>
                                                                    {loc.country && (
                                                                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                                                            {loc.country}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Branch Actions */}
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {loc.latitude !== undefined && loc.longitude !== undefined && (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                                                title="Open in Google Maps"
                                                            >
                                                                <Icon name="open_in_new" className="text-xs" />
                                                            </a>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingLocationId(isEditingThis ? null : loc.id)}
                                                            className={`p-1.5 rounded-lg transition-colors ${
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
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                            title="Remove Branch"
                                                        >
                                                            <Icon name="delete" className="text-xs" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Inline Editor for Branch Fine-tuning */}
                                                {isEditingThis && (
                                                    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-2.5 animate-fade-in-up">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">Branch Name / Label</label>
                                                                <input
                                                                    type="text"
                                                                    value={loc.label || ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'label', e.target.value)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                                                    placeholder="e.g. Zaventem Branch"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">City / Municipality</label>
                                                                <input
                                                                    type="text"
                                                                    value={loc.city || ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'city', e.target.value)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                                                    placeholder="e.g. Zaventem"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">Country</label>
                                                                <input
                                                                    type="text"
                                                                    value={loc.country || ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'country', e.target.value)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                                                    placeholder="e.g. Belgium"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">Postal Code</label>
                                                                <input
                                                                    type="text"
                                                                    value={loc.postalCode || ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'postalCode', e.target.value)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs`}
                                                                    placeholder="e.g. 1930"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">Latitude</label>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={loc.latitude ?? ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs font-mono`}
                                                                    placeholder="50.8717"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-light-text-secondary mb-1">Longitude</label>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={loc.longitude ?? ''}
                                                                    onChange={e => handleUpdateBranchField(loc.id, 'longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                    className={`${INPUT_BASE_STYLE} !py-1 !text-xs font-mono`}
                                                                    placeholder="4.4919"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingLocationId(null)}
                                                                className="text-[10px] font-bold text-primary-500 hover:underline"
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
                            )}

                            {/* Add Branch Form */}
                            {(isAddingBranch || locations.length === 0) && (
                                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-primary-500/30 space-y-3 animate-fade-in-up">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-[11px] font-bold tracking-tight text-light-text dark:text-dark-text flex items-center gap-1.5">
                                            <Icon name="add" className="text-xs text-primary-500" />
                                            <span>{locations.length === 0 ? 'Add Primary Location' : 'Add New Branch'}</span>
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
                                                className="text-[10px] font-medium text-light-text-secondary hover:text-light-text dark:hover:text-dark-text"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-light-text-secondary mb-1">
                                            Branch Label / Nickname (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={newBranchLabel}
                                            onChange={e => setNewBranchLabel(e.target.value)}
                                            className={`${INPUT_BASE_STYLE} !py-2 !text-xs`}
                                            placeholder="e.g. Zaventem, Downtown Store, Headquarters..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-light-text-secondary mb-1">
                                            Address / Location Search
                                        </label>
                                        <AddressAutocomplete
                                            value={newBranchAddress}
                                            onChange={handleNewAddressSelect}
                                            placeholder="Search e.g. IKEA Zaventem or Weiveldlaan 19, 1930 Zaventem..."
                                        />
                                    </div>

                                    {newBranchData && (
                                        <div className="p-2.5 bg-primary-500/5 rounded-xl border border-primary-500/20 text-xs flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-light-text dark:text-dark-text truncate">{newBranchData.title}</p>
                                                <p className="text-[10px] text-light-text-secondary truncate">{newBranchData.formattedAddress}</p>
                                            </div>
                                            <span className="text-[9px] font-mono text-primary-500 ml-2 shrink-0">
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
                                                className={`${BTN_SECONDARY_STYLE} !py-1.5 !px-3 !text-xs`}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleAddBranch}
                                            className={`${BTN_PRIMARY_STYLE} !py-1.5 !px-4 !text-xs`}
                                        >
                                            Save Branch
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={labelStyle}>Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className={INPUT_BASE_STYLE}
                                rows={2}
                                placeholder="Contract details, support number, etc."
                            />
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                <input
                                    type="checkbox"
                                    checked={isHidden}
                                    onChange={e => setIsHidden(e.target.checked)}
                                    className={CHECKBOX_STYLE}
                                />
                                <div className="flex items-center gap-2">
                                    <Icon name={isHidden ? "eye_off" : "eye"} className="text-base text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium text-light-text dark:text-dark-text">Hide from merchant lists</span>
                                </div>
                            </label>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1">Lifetime</p>
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(stats.totalAmount, 'EUR')}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1">Avg Ticket</p>
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(stats.averageAmount, 'EUR')}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1">Transactions</p>
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">{stats.totalCount}</p>
                            </div>
                        </div>

                        <div className="h-48 w-full">
                            <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-tight mb-2">Spending Trend (6mo)</h4>
                            <BarChart
                                data={stats.chartData}
                                xDataKey="name"
                                aspectRatio="auto"
                                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                                className="w-full h-40"
                            >
                                <Grid horizontal vertical={false} strokeOpacity={0.06} />
                                <Bar dataKey="value" fill="#3B82F6" lineCap="round" />
                                <BarXAxis />
                                <BarYAxis />
                                <ChartTooltip
                                    valueFormatter={(val: number) => formatCurrency(val, 'EUR')}
                                />
                            </BarChart>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" form="merchant-form" className={BTN_PRIMARY_STYLE}>Save Changes</button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MerchantDetailModal;
