
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { useSafeState } from '../hooks/useSafeState';

interface WarrantPriceModalProps {
  onClose: () => void;
  onSave: (isin: string, price: number | null | {date: string, price: number}[], date?: string) => void;
  isin: string;
  name: string;
  initialEntry?: { date: string; price: number };
  manualPrice?: number | null | undefined;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, initialEntry, manualPrice }) => {
    const [mode, setMode] = useState<'single' | 'bulk'>(initialEntry ? 'single' : 'single');
    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');

    // Single Entry State
    const [newPrice, setNewPrice] = useState('');
    const [date, setDate] = useState(toLocalISOString(new Date()));

    // Bulk Entry State
    const [bulkData, setBulkData] = useState('');
    const [bulkPreview, setBulkPreview] = useState<{date: string, price: number}[]>([]);
    const [fetchError, setFetchError] = useSafeState<string | null>(null);
    const [isFetching, setIsFetching] = useSafeState(false);

    // Smart Fetcher State
    const [isSmartFetcherOpen, setIsSmartFetcherOpen] = useState(false);
    const [smartFetcherUrl, setSmartFetcherUrl] = useState('');
    const [smartFetcherStatus, setSmartFetcherStatus] = useSafeState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [smartFetcherError, setSmartFetcherError] = useSafeState<string | null>(null);
    const [smartFetcherCandidates, setSmartFetcherCandidates] = useSafeState<{ id: string; value: number; selector: string; context: string; score: number }[]>([]);
    const [smartFetcherSelection, setSmartFetcherSelection] = useState<string | null>(null);
    const [smartFetcherBinding, setSmartFetcherBinding] = useState<{ url: string; selector: string; cookies?: string } | null>(null);
    const [smartFetcherCookies, setSmartFetcherCookies] = useState('');

    useEffect(() => {
        if (initialEntry) {
            setNewPrice(String(initialEntry.price));
            setDate(initialEntry.date);
            setMode('single');
        } else {
            setNewPrice(manualPrice !== undefined && manualPrice !== null ? String(manualPrice) : '');
            setDate(toLocalISOString(new Date()));
        }
    }, [initialEntry, manualPrice]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('smartPriceBindings');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, { url: string; selector: string; cookies?: string }>;
                if (parsed[isin]) {
                    setSmartFetcherBinding(parsed[isin]);
                    setSmartFetcherUrl(parsed[isin].url);
                    if (parsed[isin].cookies) {
                        setSmartFetcherCookies(parsed[isin].cookies);
                    }
                }
            }
        } catch (err) {
            console.warn('Unable to restore smart price bindings', err);
        }
    }, [isin]);

    // Parse Bulk Data
    useEffect(() => {
        if (mode === 'bulk') {
            const lines = bulkData.split('\n');
            const parsed: {date: string, price: number}[] = [];
            
            lines.forEach(line => {
                // simple parsing: look for date (YYYY-MM-DD) and a number
                const trimmed = line.trim();
                if (!trimmed) return;

                // Ensure we aren't matching the date parts as price if no other number exists
                // A better approach: split by comma/tab/space
                const parts = trimmed.split(/[\s,;]+/).filter(Boolean);

                if (parts.length >= 2) {
                    // Assume Date is one part, Price is another
                    let d = parts.find(p => p.match(/^\d{4}-\d{2}-\d{2}$/));
                    let p = parts.find(p => p !== d && p.match(/^-?\d+[.,]?\d*$/));

                    if (d && p) {
                        const normalizedPrice = normalizeDecimalString(p);
                        parsed.push({
                            date: d,
                            price: parseFloat(normalizedPrice)
                        });
                    }
                }
            });
            setBulkPreview(parsed);
        }
    }, [bulkData, mode]);

    const normalizeDecimalString = (rawValue: string): string => {
        const cleaned = rawValue
            .replace(/\s+/g, '')
            .replace(/\u00A0/g, '')
            .replace(/[^0-9.,-]/g, '');

        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        const decimalSeparator = lastDot > lastComma ? '.' : (lastComma > lastDot ? ',' : null);

        if (decimalSeparator) {
            const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
            const withoutThousands = cleaned.split(thousandsSeparator).join('');
            return withoutThousands.replace(decimalSeparator, '.');
        }

        return cleaned.replace(/,/g, '.');
    };

    const parsePriceFromText = (text: string): number | null => {
        const numericPart = text.match(/-?\d[\d.,-]*/);
        if (!numericPart) return null;

        const normalized = normalizeDecimalString(numericPart[0]);
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? null : parsed;
    };

    const fetchSmartPage = async (targetUrl: string, cookies?: string): Promise<string> => {
        const encodedUrl = encodeURIComponent(targetUrl);
        const cookieParam = cookies ? `&cookies=${encodeURIComponent(cookies)}` : '';
        const response = await fetch(`/api/smart-fetch?url=${encodedUrl}${cookieParam}`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.text();
    };

    const buildSelector = (element: Element): string => {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
            const tag = current.tagName.toLowerCase();
            const id = current.id ? `#${current.id}` : '';
            const className = (current.className && typeof current.className === 'string')
                ? `.${current.className.trim().split(/\s+/).filter(Boolean).join('.')}`
                : '';
            const siblingIndex = Array.from(current.parentElement?.children || []).indexOf(current) + 1;
            parts.unshift(`${tag}${id || className}${siblingIndex > 0 ? `:nth-child(${siblingIndex})` : ''}`);
            current = current.parentElement;
        }

        return parts.length ? parts.join(' > ') : '';
    };

    const persistSmartBinding = (binding: { url: string; selector: string; cookies?: string }) => {
        try {
            const stored = localStorage.getItem('smartPriceBindings');
            const parsed = stored ? (JSON.parse(stored) as Record<string, { url: string; selector: string; cookies?: string }>) : {};
            parsed[isin] = binding;
            localStorage.setItem('smartPriceBindings', JSON.stringify(parsed));
            setSmartFetcherBinding(binding);
        } catch (err) {
            console.error('Failed to persist smart price binding', err);
        }
    };

    const hydrateSmartFetcher = (html: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const elements = Array.from(doc.querySelectorAll('body *'));
        const candidates: { id: string; value: number; selector: string; context: string; score: number }[] = [];

        const scoreText = (text: string, el: Element) => {
            let score = 0;
            if (/€|eur/i.test(text)) score += 2;
            if (/(last|aktuell|bid|ask|preis|price)/i.test(text)) score += 1;
            if (text.length <= 20) score += 1;
            if (['strong', 'b'].includes(el.tagName.toLowerCase())) score += 1;
            return score;
        };

        const registerCandidate = (el: Element, text: string, scoreBoost = 0) => {
            const price = parsePriceFromText(text);
            if (price === null) return;
            const selector = buildSelector(el);
            const context = text.length > 80 ? `${text.slice(0, 77)}…` : text;
            candidates.push({
                id: `${candidates.length}-${selector || el.tagName}-${Math.random().toString(16).slice(2, 6)}`,
                value: price,
                selector,
                context,
                score: scoreText(text, el) + scoreBoost,
            });
        };

        const attributeSelectors = ['[data-price]', '[data-last]', '[data-value]', '[itemprop="price"]'];
        attributeSelectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => {
                const text = (el.getAttribute('content') || el.getAttribute('data-price') || el.getAttribute('data-last') || el.getAttribute('data-value') || el.textContent || '').trim();
                if (text) registerCandidate(el, text, 2);
            });
        });

        doc.querySelectorAll('meta[itemprop="price"], meta[property="product:price:amount"], meta[name="price"]').forEach(el => {
            const content = el.getAttribute('content') || '';
            if (content) registerCandidate(el, content, 3);
        });

        elements.slice(0, 2000).forEach(el => {
            const text = (el.textContent || '').trim();
            if (!text || text.length > 120) return;
            registerCandidate(el, text);
        });

        const topCandidates = candidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        setSmartFetcherCandidates(topCandidates);
        setSmartFetcherSelection(topCandidates[0]?.id || null);
        setSmartFetcherStatus(topCandidates.length ? 'ready' : 'error');
        if (!candidates.length) {
            setSmartFetcherError('No obvious price values were found on that page. Try a different URL or selector.');
        }
    };

    const handleSmartFetcher = async (opts?: { useSavedSelector?: boolean }) => {
        if (!smartFetcherUrl.trim() && !smartFetcherBinding) {
            setSmartFetcherError('Provide a page URL to scan for prices.');
            return;
        }

        const targetUrl = (opts?.useSavedSelector && smartFetcherBinding?.url) || smartFetcherUrl.trim() || smartFetcherBinding?.url || '';
        const cookies = smartFetcherCookies.trim() || smartFetcherBinding?.cookies || '';
        if (!targetUrl) {
            setSmartFetcherError('Provide a page URL to scan for prices.');
            return;
        }
        setSmartFetcherStatus('loading');
        setSmartFetcherError(null);
        setSmartFetcherCandidates([]);

        try {
            const html = await fetchSmartPage(targetUrl, cookies);

            if (opts?.useSavedSelector && smartFetcherBinding) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const element = doc.querySelector(smartFetcherBinding.selector);
                if (element) {
                    const price = parsePriceFromText(element.textContent || '');
                    if (price !== null) {
                        setNewPrice(String(price));
                        setDate(toLocalISOString(new Date()));
                        setSmartFetcherStatus('ready');
                        setSmartFetcherUrl(targetUrl);
                        return;
                    }
                }
                setSmartFetcherError('Saved selector no longer matches that page. Try scanning again.');
            }

            setSmartFetcherUrl(targetUrl);
            if (cookies) {
                setSmartFetcherCookies(cookies);
            }
            hydrateSmartFetcher(html);
        } catch (error) {
            console.error('Smart fetcher failed', error);
            setSmartFetcherStatus('error');
            setSmartFetcherError('Unable to scan that page. Some sites block cross-origin requests—try another URL or use a saved selector.');
        }
    };

    const applySmartSelection = () => {
        if (!smartFetcherSelection) return;
        const selected = smartFetcherCandidates.find(c => c.id === smartFetcherSelection);
        if (!selected) return;

        setNewPrice(String(selected.value));
        setDate(toLocalISOString(new Date()));
        const bindingUrl = smartFetcherUrl.trim() || smartFetcherBinding?.url || '';
        const cookies = smartFetcherCookies.trim() || smartFetcherBinding?.cookies;
        if (bindingUrl) {
            persistSmartBinding({ url: bindingUrl, selector: selected.selector, ...(cookies ? { cookies } : {}) });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (mode === 'single') {
            const normalized = normalizeDecimalString(newPrice);
            const parsedPrice = parseFloat(normalized);
            if (newPrice.trim() === '' || isNaN(parsedPrice)) {
                // If empty, treat as delete
                onSave(isin, null, date);
            } else {
                onSave(isin, parsedPrice, date);
            }
        } else {
            if (bulkPreview.length > 0) {
                onSave(isin, bulkPreview);
            }
        }
        onClose();
    };

    const handleFetchLatestPrice = async () => {
        if (!twelveDataApiKey) {
            setFetchError('Add your Twelve Data API key in Preferences to fetch prices automatically.');
            return;
        }

        setIsFetching(true);
        setFetchError(null);

        const fetchPrice = async (query: string) => {
            const response = await fetch(query);
            const data = await response.json();

            if (data.status === 'error' || data.code) {
                throw new Error(data.message || 'Unable to fetch price');
            }

            return data.price;
        };

        try {
            const symbol = isin.toUpperCase();
            const candidates = symbol.includes('/')
                ? [symbol]
                : [
                    `${symbol}/EUR`, // direct EUR quote for crypto pairs
                    `${symbol}/USD`, // USD quote with conversion to EUR
                    symbol // fallback to raw symbol
                ];

            let fetchedPrice: number | null = null;

            for (const candidate of candidates) {
                const queryParams = new URLSearchParams({
                    symbol: candidate,
                    apikey: twelveDataApiKey,
                });

                // Only request conversion when the quote currency is not already EUR to avoid unusable crypto prices.
                if (!candidate.toUpperCase().endsWith('/EUR')) {
                    queryParams.set('currency', 'EUR');
                }

                try {
                    fetchedPrice = await fetchPrice(`https://api.twelvedata.com/price?${queryParams.toString()}`);
                    break;
                } catch (err) {
                    // try next candidate
                    continue;
                }
            }

            if (fetchedPrice) {
                setNewPrice(String(fetchedPrice));
                setDate(toLocalISOString(new Date()));
            } else {
                setFetchError('Price not available for this symbol.');
            }
        } catch (error) {
            console.error('Failed to fetch Twelve Data price', error);
            setFetchError(error instanceof Error ? error.message : 'Unable to connect to Twelve Data. Please try again.');
        } finally {
            setIsFetching(false);
        }
    };
    
    const handleClear = () => {
        if (mode === 'single') {
            onSave(isin, null, date);
            onClose();
        } else {
            setBulkData('');
        }
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const title = initialEntry ? `Edit Price for ${initialEntry.date}` : `Log Price for ${name}`;
    
    return (
        <Modal onClose={onClose} title={title}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-8 pb-4">
                
                {/* 1. Modal Hero */}
                {!initialEntry && (
                    <div className="bg-white dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 flex flex-col items-center gap-6 shadow-sm">
                        <div className="flex bg-gray-100 dark:bg-white/10 p-1.5 rounded-2xl border border-black/5 dark:border-white/5 space-x-1 w-full max-w-sm">
                            <button
                                type="button"
                                onClick={() => setMode('single')}
                                className={`flex-1 py-2.5 text-[10px] font-black  tracking-widest rounded-xl transition-all ${mode === 'single' ? 'bg-white dark:bg-dark-card text-primary-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 opacity-60'}`}
                            >
                                Single Entry
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('bulk')}
                                className={`flex-1 py-2.5 text-[10px] font-black  tracking-widest rounded-xl transition-all ${mode === 'bulk' ? 'bg-white dark:bg-dark-card text-primary-600 shadow-md ring-1 ring-black/5' : 'text-gray-400 opacity-60'}`}
                            >
                                Bulk Manifest
                            </button>
                        </div>

                        <div className="flex items-center gap-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-500">analytics</span>
                            </div>
                            <div className="space-y-0.5 text-left">
                                <span className="text-[10px] font-black  tracking-[0.25em] text-amber-600 dark:text-amber-400 opacity-70">Current Asset</span>
                                <p className="text-lg font-black text-light-text dark:text-dark-text  tracking-tight truncate max-w-[240px]">{name}</p>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'single' ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* Entry Card */}
                        <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-8">
                            <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500 text-lg">payments</span>
                                Valuation Parameters
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-2">
                                    <label htmlFor="price-date" className={labelStyle}>Observation Date</label>
                                    <input
                                        id="price-date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className={`${INPUT_BASE_STYLE} h-14 font-black  tracking-widest`}
                                        required
                                        disabled={!!initialEntry}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="manual-price" className={labelStyle}>Unit Price</label>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400 transition-colors group-focus-within:text-primary-500">€</span>
                                        <input
                                            id="manual-price"
                                            type="number"
                                            step="any"
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(normalizeDecimalString(e.target.value))}
                                            className={`${INPUT_BASE_STYLE} pl-10 h-14 !text-3xl font-black tabular-nums`}
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Smart Tools Sub-Card */}
                            <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-lg">auto_fix</span>
                                        </div>
                                        <span className="text-[10px] font-black  tracking-[0.25em] text-indigo-600 dark:text-indigo-400">Autonomous Retrieval</span>
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={handleFetchLatestPrice}
                                            className={`px-3 py-1.5 text-[9px] font-black  tracking-widest rounded-lg transition-all ${!isFetching ? 'text-indigo-600 hover:bg-white dark:hover:bg-dark-card' : 'opacity-50'}`}
                                            disabled={isFetching}
                                        >
                                            {isFetching ? 'Syncing...' : 'Twelve Data'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsSmartFetcherOpen(prev => !prev)}
                                            className={`px-3 py-1.5 text-[9px] font-black  tracking-widest rounded-lg transition-all ${isSmartFetcherOpen ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-white dark:hover:bg-dark-card'}`}
                                        >
                                            Smart Fetch
                                        </button>
                                    </div>
                                </div>

                                {isSmartFetcherOpen && (
                                    <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-200/30 dark:border-indigo-800/20 space-y-6 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black  tracking-widest text-indigo-900/40 dark:text-indigo-300/40 px-1">Source URL</label>
                                                <input
                                                    type="url"
                                                    value={smartFetcherUrl}
                                                    onChange={(e) => setSmartFetcherUrl(e.target.value)}
                                                    placeholder="Target landing page..."
                                                    className={`${INPUT_BASE_STYLE} h-11 !text-xs border-indigo-200/50 dark:border-indigo-800/50`}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black  tracking-widest text-indigo-900/40 dark:text-indigo-300/40 px-1">Session Data (Cookies)</label>
                                                <input
                                                    type="text"
                                                    value={smartFetcherCookies}
                                                    onChange={(e) => setSmartFetcherCookies(e.target.value)}
                                                    placeholder="Optional session tokens..."
                                                    className={`${INPUT_BASE_STYLE} h-11 !text-xs border-indigo-200/50 dark:border-indigo-800/50`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleSmartFetcher()}
                                                className="flex-1 h-12 bg-indigo-600 text-white text-[10px] font-black  tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                                disabled={smartFetcherStatus === 'loading'}
                                            >
                                                <span className="material-symbols-outlined text-lg">{smartFetcherStatus === 'loading' ? 'sync' : 'radar'}</span>
                                                {smartFetcherStatus === 'loading' ? 'Extracting Data...' : 'Scan Webpage'}
                                            </button>
                                            {smartFetcherBinding && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSmartFetcher({ useSavedSelector: true })}
                                                    className="w-12 h-12 flex items-center justify-center bg-white dark:bg-dark-card text-indigo-600 rounded-xl hover:shadow-md transition-all border border-indigo-200/50 dark:border-indigo-800/50 shadow-sm"
                                                    title="Refresh from saved binding"
                                                    disabled={smartFetcherStatus === 'loading'}
                                                >
                                                    <span className="material-symbols-outlined text-lg">refresh</span>
                                                </button>
                                            )}
                                        </div>

                                        {smartFetcherCandidates.length > 0 && (
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-sm text-indigo-600">center_focus_strong</span>
                                                        <p className="text-[10px] font-black  tracking-[0.2em] text-indigo-950/60 dark:text-indigo-300/60">Extracted Values</p>
                                                    </div>
                                                    <span className="text-[9px] font-black text-indigo-600/50 px-2 py-0.5 rounded-full bg-indigo-600/5 ">Select Binding</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-auto pr-2 custom-scrollbar">
                                                    {smartFetcherCandidates.map(candidate => (
                                                        <label key={candidate.id} className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer relative group ${smartFetcherSelection === candidate.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5 text-light-text dark:text-dark-text hover:border-indigo-300/50'}`}>
                                                            <input
                                                                type="radio"
                                                                name="smart-fetcher-price"
                                                                checked={smartFetcherSelection === candidate.id}
                                                                onChange={() => setSmartFetcherSelection(candidate.id)}
                                                                className="sr-only"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xl tabular-nums mb-1 tracking-tight">€{candidate.value}</p>
                                                                <p className="text-[9px] font-black opacity-60 truncate  tracking-tighter">{candidate.context}</p>
                                                            </div>
                                                            {smartFetcherSelection === candidate.id && <span className="material-symbols-outlined text-base absolute top-3 right-3 text-white/50">check_circle</span>}
                                                        </label>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={applySmartSelection}
                                                    className="w-full h-12 bg-white dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black  tracking-widest rounded-xl border border-indigo-600/20 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                                                    disabled={!smartFetcherSelection}
                                                >
                                                    Finalize & Bind Selector
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-light-fill dark:bg-dark-fill/50 p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary-500 text-lg">description</span>
                                    Input Stream
                                </h4>
                                <div className="text-[9px] font-black text-primary-500/50 px-2 py-0.5 rounded-full bg-primary-500/5  tracking-widest">TSV/CSV Format</div>
                            </div>
                            <textarea
                                id="bulk-data"
                                value={bulkData}
                                onChange={(e) => setBulkData(e.target.value)}
                                className={`${INPUT_BASE_STYLE} font-mono !text-xs h-64 p-6 leading-relaxed bg-white dark:bg-black/20 border-black/5 dark:border-white/5 focus:ring-1 focus:ring-primary-500/20`}
                                placeholder={`YYYY-MM-DD VALUE\n2024-05-10 1282.50\n2024-05-11 1290.10`}
                                autoFocus
                            />
                            <AnimatePresence>
                                {bulkPreview.length > 0 && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-emerald-500 text-base">task_alt</span>
                                            </div>
                                            <span className="text-[10px] font-black  tracking-[0.2em] text-emerald-700 dark:text-emerald-400">{bulkPreview.length} Validated Data Points Detected</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-between items-center pt-8 border-t border-black/5 dark:border-white/5">
                     <div className="w-32">
                        {mode === 'single' ? (
                            <button type="button" onClick={handleClear} className="h-12 px-6 text-[10px] font-black  tracking-widest text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all active:scale-95">
                                {initialEntry ? 'Purge Record' : 'Reset Inputs'}
                            </button>
                        ) : (
                            <button type="button" onClick={() => setBulkData('')} className="h-12 px-6 text-[10px] font-black  tracking-widest text-gray-400 hover:text-gray-600 rounded-xl transition-all">Clear All</button>
                        )}
                     </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-12 px-8  tracking-widest text-[10px] font-black`}>Retract</button>
                        <button 
                            type="submit" 
                            className={`${BTN_PRIMARY_STYLE} h-12 px-10 gap-3 group animate-glow  tracking-widest text-[10px] font-black disabled:opacity-50`} 
                            disabled={mode === 'bulk' && bulkPreview.length === 0}
                        >
                            {mode === 'bulk' ? 'Commit Batch' : 'Log Valuation'}
                            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">save</span>
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantPriceModal;
