
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';

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
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Smart Fetcher State
    const [isSmartFetcherOpen, setIsSmartFetcherOpen] = useState(false);
    const [smartFetcherUrl, setSmartFetcherUrl] = useState('');
    const [smartFetcherStatus, setSmartFetcherStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [smartFetcherError, setSmartFetcherError] = useState<string | null>(null);
    const [smartFetcherCandidates, setSmartFetcherCandidates] = useState<{ id: string; value: number; selector: string; context: string; score: number }[]>([]);
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
        let authToken: string | null = null;
        try {
            authToken = window.localStorage.getItem('crystal_auth_token');
        } catch (error) {
            console.warn('Unable to read auth token for smart fetch.', error);
        }

        const response = await fetch(`/api/smart-fetch?url=${encodedUrl}${cookieParam}`, {
            headers: {
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
        });
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
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {!initialEntry && (
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-lg mb-4">
                        <button
                            type="button"
                            onClick={() => setMode('single')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'single' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Single Entry
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('bulk')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'bulk' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Bulk Import
                        </button>
                    </div>
                )}

                {mode === 'single' ? (
                    <>
                        <div>
                            <label htmlFor="price-date" className={labelStyle}>Date</label>
                            <input
                                id="price-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={INPUT_BASE_STYLE}
                                required
                                disabled={!!initialEntry}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-price" className={labelStyle}>Price per Unit (€)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">€</span>
                                <input
                                    id="manual-price"
                                    type="number"
                                    step="any"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(normalizeDecimalString(e.target.value))}
                                    className={`${INPUT_BASE_STYLE} pl-8`}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col gap-2 mt-3">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={handleFetchLatestPrice}
                                        className={`${BTN_SECONDARY_STYLE} !py-2 flex items-center gap-2`}
                                        disabled={isFetching}
                                    >
                                        <span className="material-symbols-outlined text-lg">cloud_download</span>
                                        {isFetching ? 'Fetching…' : 'Fetch from Twelve Data'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsSmartFetcherOpen(prev => !prev)}
                                        className={`${BTN_SECONDARY_STYLE} !py-2 flex items-center gap-2`}
                                    >
                                        <span className="material-symbols-outlined text-lg">travel_explore</span>
                                        {isSmartFetcherOpen ? 'Hide Smart Fetcher' : 'Smart Fetch from Website'}
                                    </button>
                                </div>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    Uses your saved Twelve Data API key or a custom web page scan for hard-to-find warrant prices.
                                </p>
                            </div>
                            {fetchError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    {fetchError}
                                </p>
                            )}
                            {isSmartFetcherOpen && (
                                <div className="mt-3 space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="space-y-2">
                                        <label className={labelStyle}>Page URL to scan</label>
                                        <input
                                            type="url"
                                            value={smartFetcherUrl}
                                            onChange={(e) => setSmartFetcherUrl(e.target.value)}
                                            placeholder="https://example.com/your-warrant"
                                            className={INPUT_BASE_STYLE}
                                        />
                                        <label className={labelStyle}>Optional cookies (useful for T&C or disclaimer gates)</label>
                                        <input
                                            type="text"
                                            value={smartFetcherCookies}
                                            onChange={(e) => setSmartFetcherCookies(e.target.value)}
                                            placeholder="consent=true; disclaimerAccepted=1"
                                            className={INPUT_BASE_STYLE}
                                        />
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            Paste cookies after accepting any T&C or disclaimer in your browser so the proxy can reuse that session and reach the real price data.
                                        </p>
                                        {smartFetcherBinding && (
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                Saved selector for this holding: <span className="font-mono break-all">{smartFetcherBinding.selector}</span>
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleSmartFetcher()}
                                                className={`${BTN_SECONDARY_STYLE} !py-2 flex items-center gap-2`}
                                                disabled={smartFetcherStatus === 'loading'}
                                            >
                                                <span className="material-symbols-outlined text-lg">search</span>
                                                {smartFetcherStatus === 'loading' ? 'Scanning…' : 'Scan page for prices'}
                                            </button>
                                            {smartFetcherBinding && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSmartFetcher({ useSavedSelector: true })}
                                                    className={`${BTN_SECONDARY_STYLE} !py-2 flex items-center gap-2`}
                                                    disabled={smartFetcherStatus === 'loading'}
                                                >
                                                    <span className="material-symbols-outlined text-lg">refresh</span>
                                                    Refresh from saved selector
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {smartFetcherStatus === 'loading' && (
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                            Looking for price-like values on the page…
                                        </p>
                                    )}

                                    {smartFetcherCandidates.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                                                <span className="material-symbols-outlined text-lg">radar</span>
                                                Select the correct price below
                                            </p>
                                            <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                                {smartFetcherCandidates.map(candidate => (
                                                    <label key={candidate.id} className="flex items-start gap-2 p-2 rounded-lg border border-black/5 dark:border-white/5 bg-white dark:bg-dark-card">
                                                        <input
                                                            type="radio"
                                                            name="smart-fetcher-price"
                                                            checked={smartFetcherSelection === candidate.id}
                                                            onChange={() => setSmartFetcherSelection(candidate.id)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-bold text-light-text dark:text-dark-text">€{candidate.value}</p>
                                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary break-words">{candidate.context}</p>
                                                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Selector: <span className="font-mono break-all">{candidate.selector}</span></p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={applySmartSelection}
                                                className={`${BTN_PRIMARY_STYLE} !py-2 w-full`}
                                                disabled={!smartFetcherSelection}
                                            >
                                                Use selected price and remember this location
                                            </button>
                                        </div>
                                    )}

                                    {smartFetcherError && (
                                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-base">error</span>
                                            {smartFetcherError}
                                        </p>
                                    )}

                                    {smartFetcherBinding && smartFetcherStatus === 'ready' && !smartFetcherError && (
                                        <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            Saved price location for quick refreshes.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-3">
                         <div>
                            <label htmlFor="bulk-data" className={labelStyle}>Data (YYYY-MM-DD Price)</label>
                            <textarea
                                id="bulk-data"
                                value={bulkData}
                                onChange={(e) => setBulkData(e.target.value)}
                                className={`${INPUT_BASE_STYLE} font-mono text-sm`}
                                rows={6}
                                placeholder={`2023-01-01 150.00\n2023-02-01 155.50\n2023-03-01 162.25`}
                                autoFocus
                            />
                             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                 Paste dates and prices separated by space, comma or tab.
                             </p>
                        </div>
                        {bulkPreview.length > 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30">
                                <p className="text-sm text-green-700 dark:text-green-300 font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    {bulkPreview.length} entries recognized
                                </p>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-between items-center pt-4 border-t border-black/5 dark:border-white/5">
                     {mode === 'single' ? (
                        <button type="button" onClick={handleClear} className={BTN_DANGER_STYLE}>
                            {initialEntry ? 'Delete Entry' : 'Clear Value'}
                        </button>
                     ) : (
                         <div /> // Spacer
                     )}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE} disabled={mode === 'bulk' && bulkPreview.length === 0}>
                            {mode === 'bulk' ? 'Import Prices' : 'Save Price'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantPriceModal;
