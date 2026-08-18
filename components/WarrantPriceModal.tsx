import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SmartPriceBinding } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { toLocalISOString } from '../utils';
import { usePreferencesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import Icon from './ui/Icon';

const normalizeDecimalString = (str: string): string => {
    const cleaned = str
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

interface WarrantPriceModalProps {
    onClose: () => void;
    onSave: (isin: string, price: number | null | { date: string; price: number }[], date?: string) => void;
    isin: string;
    name: string;
    initialEntry?: { date: string; price: number } | null;
    manualPrice?: number;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, initialEntry, manualPrice }) => {
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [newPrice, setNewPrice] = useState(
        initialEntry 
            ? String(initialEntry.price) 
            : (manualPrice !== undefined && manualPrice !== null ? String(manualPrice) : '')
    );
    const [date, setDate] = useState(initialEntry ? initialEntry.date : toLocalISOString(new Date()));
    const [bulkData, setBulkData] = useState('');
    const [bulkPreview, setBulkPreview] = useState<{ date: string; price: number }[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSmartFetcherOpen, setIsSmartFetcherOpen] = useState(false);
    const [smartFetcherUrl, setSmartFetcherUrl] = useState('');
    const [smartFetcherCookies, setSmartFetcherCookies] = useState('');
    const [smartFetcherCandidates, setSmartFetcherCandidates] = useState<{ id: string; value: number; selector: string; context: string }[]>([]);
    const [smartFetcherSelection, setSmartFetcherSelection] = useState<string | null>(null);
    const [smartFetcherStatus, setSmartFetcherStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [smartFetcherError, setSmartFetcherError] = useState<string | null>(null);
    const [smartFetcherBinding, setSmartFetcherBinding] = useState<SmartPriceBinding | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const { preferences, setPreferences } = usePreferencesContext();
    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');
    const [twelveDataTicker, setTwelveDataTicker] = useState(preferences.investmentPriceConfigs?.[isin]?.ticker || isin);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 20);
        return () => clearTimeout(timer);
    }, []);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    // Hydrate saved binding with priority to synced preferences, fallback to localStorage
    useEffect(() => {
        try {
            const syncedBinding = preferences.smartPriceBindings?.[isin] || preferences.investmentPriceConfigs?.[isin]?.binding;
            if (syncedBinding) {
                setSmartFetcherBinding(syncedBinding);
                setSmartFetcherUrl(syncedBinding.url || '');
                setSmartFetcherCookies(syncedBinding.cookies || '');
                return;
            }

            const stored = localStorage.getItem('smartPriceBindings');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, SmartPriceBinding>;
                const localBinding = parsed[isin];
                if (localBinding) {
                    setSmartFetcherBinding(localBinding);
                    setSmartFetcherUrl(localBinding.url || '');
                    setSmartFetcherCookies(localBinding.cookies || '');
                    // Migrate to cloud preferences
                    persistSmartBinding(localBinding);
                }
            }
        } catch (err) {
            console.error('Failed to parse smart price bindings', err);
        }
    }, [isin, preferences.smartPriceBindings, preferences.investmentPriceConfigs]);

    // Parse Bulk Data
    useEffect(() => {
        if (mode !== 'bulk') return;
        const lines = bulkData.split('\n');
        const parsed: { date: string; price: number }[] = [];
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const parts = trimmed.split(/[\t, ]+/);
            if (parts.length >= 2) {
                const d = parts[0].trim();
                const p = parseFloat(parts[1].trim());
                if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(p)) {
                    parsed.push({ date: d, price: p });
                }
            }
        });
        setBulkPreview(parsed);
    }, [bulkData, mode]);

    const fetchSmartPage = async (url: string, cookies?: string) => {
        const params = new URLSearchParams({ url });
        if (cookies) {
            params.set('cookies', cookies);
        }
        const response = await fetch(`/api/smart-fetch?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Smart fetch failed with status ${response.status}`);
        }
        return response.text();
    };

    const buildSelector = (el: Element | null): string => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
        const parts: string[] = [];
        let curr: Element | null = el;

        while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName.toLowerCase() !== 'body') {
            const tag = curr.tagName.toLowerCase();
            const id = curr.getAttribute('id');
            const dataTestId = curr.getAttribute('data-testid');

            if (id) {
                parts.unshift(`#${id}`);
                break;
            }
            if (dataTestId) {
                parts.unshift(`[data-testid="${dataTestId}"]`);
                break;
            }

            const classes = Array.from(curr.classList || [])
                .filter(cls => !cls.includes(':') && !cls.includes('/') && !cls.includes('[') && cls.length < 24)
                .slice(0, 2);

            let segment = tag;
            if (classes.length) {
                segment += `.${classes.join('.')}`;
            }

            const parent = curr.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(sibling => sibling.tagName === curr!.tagName);
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(curr) + 1;
                    segment += `:nth-of-type(${idx})`;
                }
            }

            parts.unshift(segment);
            curr = curr.parentElement;
        }

        return parts.length ? parts.join(' > ') : '';
    };

    const persistSmartBinding = (binding: SmartPriceBinding) => {
        try {
            // 1. Persist to App Preferences (synced to server and available on all devices)
            setPreferences(prev => {
                const currentBindings = prev.smartPriceBindings || {};
                const currentConfigs = prev.investmentPriceConfigs || {};
                return {
                    ...prev,
                    smartPriceBindings: {
                        ...currentBindings,
                        [isin]: binding,
                    },
                    investmentPriceConfigs: {
                        ...currentConfigs,
                        [isin]: {
                            ...(currentConfigs[isin] || {}),
                            source: 'web',
                            binding,
                        },
                    },
                };
            });

            // 2. Mirror to localStorage as offline cache
            const stored = localStorage.getItem('smartPriceBindings');
            const parsed = stored ? (JSON.parse(stored) as Record<string, SmartPriceBinding>) : {};
            parsed[isin] = binding;
            localStorage.setItem('smartPriceBindings', JSON.stringify(parsed));
            setSmartFetcherBinding(binding);
        } catch (err) {
            console.error('Failed to persist smart price binding', err);
        }
    };

    const removeSmartBinding = () => {
        try {
            setPreferences(prev => {
                const nextBindings = { ...(prev.smartPriceBindings || {}) };
                delete nextBindings[isin];
                const nextConfigs = { ...(prev.investmentPriceConfigs || {}) };
                if (nextConfigs[isin]) {
                    delete nextConfigs[isin].binding;
                }
                return {
                    ...prev,
                    smartPriceBindings: nextBindings,
                    investmentPriceConfigs: nextConfigs,
                };
            });

            const stored = localStorage.getItem('smartPriceBindings');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, SmartPriceBinding>;
                delete parsed[isin];
                localStorage.setItem('smartPriceBindings', JSON.stringify(parsed));
            }

            setSmartFetcherBinding(null);
            setSmartFetcherUrl('');
            setSmartFetcherCookies('');
            setSmartFetcherCandidates([]);
            setSmartFetcherSelection(null);
        } catch (err) {
            console.error('Failed to remove smart price binding', err);
        }
    };

    const persistTwelveDataTicker = (ticker: string) => {
        const cleaned = ticker.trim().toUpperCase();
        setTwelveDataTicker(cleaned);
        if (cleaned) {
            setPreferences(prev => {
                const currentConfigs = prev.investmentPriceConfigs || {};
                return {
                    ...prev,
                    investmentPriceConfigs: {
                        ...currentConfigs,
                        [isin]: {
                            ...(currentConfigs[isin] || {}),
                            source: 'twelvedata',
                            ticker: cleaned,
                        },
                    },
                };
            });
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
        handleClose();
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
            const targetSymbol = (twelveDataTicker.trim() || isin).toUpperCase();
            const candidates = targetSymbol.includes('/')
                ? [targetSymbol]
                : [
                    `${targetSymbol}/EUR`, // direct EUR quote for crypto pairs
                    `${targetSymbol}/USD`, // USD quote with conversion to EUR
                    targetSymbol // fallback to raw symbol
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
                if (twelveDataTicker.trim() && twelveDataTicker.trim().toUpperCase() !== isin.toUpperCase()) {
                    persistTwelveDataTicker(twelveDataTicker);
                }
            } else {
                setFetchError(`Price not available from Twelve Data for "${targetSymbol}".`);
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
            handleClose();
        } else {
            setBulkData('');
        }
    };

    const labelStyle = "block text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5";
    const title = initialEntry ? `Edit Valuation Entry` : `Log Valuation`;

    const content = (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={handleClose}
            />

            {/* Sidebar Drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div 
                    className={`w-screen max-w-lg bg-light-card dark:bg-dark-card shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
                        isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 via-primary-500/5 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-xs">
                                <Icon name="price_change" className="text-xl" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                                        {title}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0 font-mono">
                                        {isin}
                                    </span>
                                </div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                                    {name}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                            aria-label="Close drawer"
                        >
                            <Icon name="close" className="text-lg" />
                        </button>
                    </div>

                    {/* Mode Segment Switcher */}
                    {!initialEntry && (
                        <div className="px-6 pt-5 pb-2">
                            <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setMode('single')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                                        mode === 'single'
                                            ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    Single Entry
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('bulk')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                                        mode === 'bulk'
                                            ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-light-text-secondary dark:text-dark-text-secondary opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    Bulk Manifest (CSV)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Form / Scrollable Content */}
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {mode === 'single' ? (
                                <div className="space-y-6 animate-fade-in">
                                    
                                    {/* Observation Date & Unit Price Grid */}
                                    <div className="space-y-4 p-5 rounded-3xl bg-light-fill dark:bg-dark-fill/50 border border-black/5 dark:border-white/5">
                                        <div>
                                            <label htmlFor="price-date" className={labelStyle}>
                                                Observation Date <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                id="price-date"
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className={`${INPUT_BASE_STYLE} h-12 font-semibold tracking-wide`}
                                                required
                                                disabled={!!initialEntry}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="manual-price" className={labelStyle}>
                                                Unit Price (€) <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                                    €
                                                </span>
                                                <input
                                                    id="manual-price"
                                                    type="number"
                                                    step="any"
                                                    value={newPrice}
                                                    onChange={(e) => setNewPrice(normalizeDecimalString(e.target.value))}
                                                    className={`${INPUT_BASE_STYLE} pl-10 h-14 !text-2xl font-black tabular-nums`}
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Autonomous Retrieval Section */}
                                    <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50/40 via-indigo-50/20 to-transparent dark:from-indigo-950/20 dark:via-indigo-950/10 dark:to-transparent border border-indigo-200/40 dark:border-indigo-800/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                                    <Icon name="auto_fix" className="text-base" />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block leading-tight">
                                                        Autonomous Retrieval
                                                    </span>
                                                    <span className="text-2xs text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                                                        Synced across all devices
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center bg-gray-100 dark:bg-white/10 p-1 rounded-xl gap-1">
                                                <button
                                                    type="button"
                                                    onClick={handleFetchLatestPrice}
                                                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${!isFetching ? 'text-indigo-600 hover:bg-white dark:hover:bg-dark-card' : 'opacity-50'}`}
                                                    disabled={isFetching}
                                                    title="Fetch current market price via Twelve Data"
                                                >
                                                    {isFetching ? 'Syncing...' : 'Twelve Data'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSmartFetcherOpen(prev => !prev)}
                                                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${isSmartFetcherOpen ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-white dark:hover:bg-dark-card'}`}
                                                    title="Configure custom webpage scraping selector"
                                                >
                                                    Smart Fetch
                                                </button>
                                            </div>
                                        </div>

                                        {smartFetcherBinding && !isSmartFetcherOpen && (
                                            <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-between gap-3 animate-fade-in">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                        <Icon name="cloud_done" className="text-base" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                                                                Web Fetching Configured
                                                            </p>
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-2xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                                                Cloud Synced
                                                            </span>
                                                        </div>
                                                        <p className="text-2xs text-indigo-900/60 dark:text-indigo-300/60 truncate font-mono mt-0.5" title={smartFetcherBinding.url}>
                                                            {smartFetcherBinding.url}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSmartFetcher({ useSavedSelector: true })}
                                                        disabled={smartFetcherStatus === 'loading'}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-dark-card border border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1"
                                                        title="Test Fetch Price"
                                                    >
                                                        <Icon name="refresh" className={`text-xs ${smartFetcherStatus === 'loading' ? 'animate-spin' : ''}`} />
                                                        <span>Fetch</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={removeSmartBinding}
                                                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                                                        title="Remove Web Binding"
                                                    >
                                                        <Icon name="delete" className="text-xs" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {fetchError && (
                                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                                                <Icon name="error" className="text-sm shrink-0" />
                                                <span>{fetchError}</span>
                                            </div>
                                        )}

                                        {isSmartFetcherOpen && (
                                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-200/30 dark:border-indigo-800/20 space-y-4 animate-fade-in">
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <label className="text-2xs font-bold uppercase tracking-wider text-indigo-900/60 dark:text-indigo-300/60">Source Webpage URL</label>
                                                        <input
                                                            type="url"
                                                            value={smartFetcherUrl}
                                                            onChange={(e) => setSmartFetcherUrl(e.target.value)}
                                                            placeholder="https://finance.example.com/asset..."
                                                            className={`${INPUT_BASE_STYLE} h-10 !text-xs border-indigo-200/50 dark:border-indigo-800/50`}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-2xs font-bold uppercase tracking-wider text-indigo-900/60 dark:text-indigo-300/60">Session Data / Cookies (Optional)</label>
                                                        <input
                                                            type="text"
                                                            value={smartFetcherCookies}
                                                            onChange={(e) => setSmartFetcherCookies(e.target.value)}
                                                            placeholder="session_id=xyz; auth=abc..."
                                                            className={`${INPUT_BASE_STYLE} h-10 !text-xs border-indigo-200/50 dark:border-indigo-800/50`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSmartFetcher()}
                                                        className="flex-1 h-11 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                                        disabled={smartFetcherStatus === 'loading'}
                                                    >
                                                        <Icon name={smartFetcherStatus === 'loading' ? 'sync' : 'radar'} className={`text-base ${smartFetcherStatus === 'loading' ? 'animate-spin' : ''}`} />
                                                        {smartFetcherStatus === 'loading' ? 'Scanning Webpage...' : 'Scan Webpage for Prices'}
                                                    </button>
                                                    {smartFetcherBinding && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSmartFetcher({ useSavedSelector: true })}
                                                            className="w-11 h-11 flex items-center justify-center bg-white dark:bg-dark-card text-indigo-600 rounded-xl hover:shadow-md transition-all border border-indigo-200/50 dark:border-indigo-800/50 shadow-xs"
                                                            title="Refresh from saved binding"
                                                            disabled={smartFetcherStatus === 'loading'}
                                                        >
                                                            <Icon name="refresh" className="text-base" />
                                                        </button>
                                                    )}
                                                </div>

                                                {smartFetcherError && (
                                                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                                                        <Icon name="error" className="text-sm shrink-0" />
                                                        <span>{smartFetcherError}</span>
                                                    </div>
                                                )}

                                                {smartFetcherCandidates.length > 0 && (
                                                    <div className="space-y-3 pt-2">
                                                        <div className="flex items-center justify-between px-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Icon name="center_focus_strong" className="text-sm text-indigo-600" />
                                                                <span className="text-2xs font-bold uppercase tracking-wider text-indigo-950/60 dark:text-indigo-300/60">Extracted Values</span>
                                                            </div>
                                                            <span className="text-2xs font-semibold text-indigo-600/70 px-2 py-0.5 rounded-full bg-indigo-600/5">Select Best Match</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-auto pr-1 custom-scrollbar">
                                                            {smartFetcherCandidates.map(candidate => (
                                                                <label key={candidate.id} className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer relative group ${smartFetcherSelection === candidate.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-dark-card border-black/5 dark:border-white/5 text-light-text dark:text-dark-text hover:border-indigo-300/50'}`}>
                                                                    <input
                                                                        type="radio"
                                                                        name="smart-fetcher-price"
                                                                        checked={smartFetcherSelection === candidate.id}
                                                                        onChange={() => setSmartFetcherSelection(candidate.id)}
                                                                        className="sr-only"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-black text-lg tabular-nums tracking-tight">€{candidate.value}</p>
                                                                        <p className="text-2xs font-medium opacity-60 truncate tracking-tight">{candidate.context}</p>
                                                                    </div>
                                                                    {smartFetcherSelection === candidate.id && <Icon name="check_circle" className="text-sm absolute top-2.5 right-2.5 text-white/70" />}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={applySmartSelection}
                                                            className="w-full h-11 bg-white dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-xl border border-indigo-600/20 hover:bg-indigo-50 transition-all shadow-xs active:scale-95"
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
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="p-5 bg-light-fill dark:bg-dark-fill/50 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                                <Icon name="description" className="text-primary-500 text-base" />
                                                TSV / CSV Batch Input
                                            </h4>
                                            <span className="text-2xs font-bold text-primary-500/80 px-2 py-0.5 rounded-full bg-primary-500/10 uppercase tracking-wider">
                                                YYYY-MM-DD VALUE
                                            </span>
                                        </div>
                                        <textarea
                                            id="bulk-data"
                                            value={bulkData}
                                            onChange={(e) => setBulkData(e.target.value)}
                                            className={`${INPUT_BASE_STYLE} font-mono !text-xs h-56 p-4 leading-relaxed bg-white dark:bg-black/20 border-black/5 dark:border-white/5`}
                                            placeholder={`2024-05-10 128.50\n2024-05-11 129.10\n2024-05-12 130.00`}
                                            autoFocus
                                        />
                                        {bulkPreview.length > 0 && (
                                            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                        <Icon name="task_alt" className="text-emerald-500 text-sm" />
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                                        {bulkPreview.length} Historical Points Validated
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md flex items-center justify-between gap-3">
                            <div>
                                {mode === 'single' ? (
                                    <button 
                                        type="button" 
                                        onClick={handleClear} 
                                        className="h-12 px-4 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"
                                    >
                                        {initialEntry ? 'Purge Record' : 'Reset'}
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => setBulkData('')} 
                                        className="h-12 px-4 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text rounded-xl transition-all"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    type="button" 
                                    onClick={handleClose} 
                                    className={`${BTN_SECONDARY_STYLE} h-12 px-6 text-xs font-bold uppercase tracking-wider`}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`${BTN_PRIMARY_STYLE} h-12 px-8 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 disabled:opacity-50`}
                                    disabled={mode === 'bulk' && bulkPreview.length === 0}
                                >
                                    <span>{mode === 'bulk' ? 'Commit Batch' : 'Log Valuation'}</span>
                                    <Icon name="save" className="text-base" />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default WarrantPriceModal;
